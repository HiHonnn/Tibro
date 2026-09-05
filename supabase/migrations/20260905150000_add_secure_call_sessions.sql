-- Secure signalling for foreground one-to-one voice/video calls.
-- Media credentials are issued by the backend; clients can only read sessions
-- in which they participate and cannot forge call state directly.

CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_name text NOT NULL UNIQUE,
  is_video boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing', 'accepted', 'declined', 'cancelled', 'ended', 'missed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT call_sessions_distinct_users CHECK (caller_id <> receiver_id)
);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.call_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.call_sessions TO authenticated;

CREATE POLICY "call_sessions_select_participants"
ON public.call_sessions FOR SELECT TO authenticated
USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());

CREATE UNIQUE INDEX call_sessions_one_active_conversation_uidx
  ON public.call_sessions (conversation_id)
  WHERE status IN ('ringing', 'accepted');

CREATE INDEX call_sessions_receiver_recent_idx
  ON public.call_sessions (receiver_id, created_at DESC);

CREATE INDEX call_sessions_participants_recent_idx
  ON public.call_sessions (caller_id, receiver_id, created_at DESC);

-- Serialize call creation for both participants so one account cannot be in
-- two ringing/accepted calls at once, even when requests arrive concurrently.
CREATE OR REPLACE FUNCTION public.enforce_one_active_call_per_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_first uuid := LEAST(NEW.caller_id, NEW.receiver_id);
  v_second uuid := GREATEST(NEW.caller_id, NEW.receiver_id);
BEGIN
  IF NEW.status NOT IN ('ringing', 'accepted') THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_first::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_second::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.call_sessions AS active_call
    WHERE active_call.id <> NEW.id
      AND active_call.status IN ('ringing', 'accepted')
      AND (
        active_call.caller_id IN (NEW.caller_id, NEW.receiver_id)
        OR active_call.receiver_id IN (NEW.caller_id, NEW.receiver_id)
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'a participant already has an active call';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_one_active_call_per_user_trigger ON public.call_sessions;
CREATE TRIGGER enforce_one_active_call_per_user_trigger
BEFORE INSERT OR UPDATE OF caller_id, receiver_id, status ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_one_active_call_per_user();

REVOKE ALL ON FUNCTION public.enforce_one_active_call_per_user() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'call_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
  END IF;
END
$$;
