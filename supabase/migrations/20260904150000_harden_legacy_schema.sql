-- Tibro security hardening after importing the legacy Supabase schema.
-- Keep the previous migration unchanged: it is the reproducible snapshot of the old project.

-- Zego call signalling is no longer used by the application.
DROP TABLE IF EXISTS public.call_signals CASCADE;
DROP FUNCTION IF EXISTS public.delete_old_call_signals();

-- Helper used by admin-only RLS policies. The empty search_path prevents object shadowing.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admins
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Return only fields that are safe to show to another signed-in user.
-- This replaces direct cross-user reads from public.users (which also stores email,
-- session_token and moderation state).
CREATE OR REPLACE FUNCTION public.get_public_profiles(
  p_user_ids uuid[] DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  name text,
  avatar text,
  username text,
  online_at timestamptz,
  gender text,
  birthday text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id, u.name, u.avatar, u.username, u.online_at, u.gender, u.birthday
  FROM public.users AS u
  WHERE auth.uid() IS NOT NULL
    AND (p_user_ids IS NULL OR u.id = ANY (p_user_ids))
    AND (
      p_query IS NULL
      OR u.username ILIKE '%' || p_query || '%'
      OR u.name ILIKE '%' || p_query || '%'
    )
  ORDER BY u.name NULLS LAST, u.username NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[], text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[], text, integer) TO authenticated, service_role;

-- A narrow pre-sign-up check avoids granting anonymous SELECT on public.users.
CREATE OR REPLACE FUNCTION public.is_username_available(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    candidate IS NOT NULL
    AND char_length(btrim(candidate)) BETWEEN 3 AND 30
    AND btrim(candidate) ~ '^[A-Za-z0-9_.]+$'
    AND NOT EXISTS (
      SELECT 1 FROM public.users WHERE lower(username) = lower(btrim(candidate))
    );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated, service_role;

-- Nearby discovery happens in Postgres so clients can never download every live location.
CREATE OR REPLACE FUNCTION public.find_nearby_users(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer DEFAULT 20
)
RETURNS TABLE (
  user_id uuid,
  latitude double precision,
  longitude double precision,
  is_sharing boolean,
  updated_at timestamptz,
  distance_meters integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    ul.user_id,
    ul.latitude,
    ul.longitude,
    ul.is_sharing,
    ul.updated_at,
    round(d.distance_meters)::integer
  FROM public.user_locations AS ul
  CROSS JOIN LATERAL (
    SELECT 6371000.0 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(p_latitude)) * cos(radians(ul.latitude))
          * cos(radians(ul.longitude) - radians(p_longitude))
        + sin(radians(p_latitude)) * sin(radians(ul.latitude))
      ))
    ) AS distance_meters
  ) AS d
  WHERE auth.uid() IS NOT NULL
    AND ul.user_id <> auth.uid()
    AND ul.is_sharing = true
    AND ul.latitude IS NOT NULL
    AND ul.longitude IS NOT NULL
    AND ul.updated_at >= now() - interval '5 minutes'
    AND d.distance_meters <= LEAST(GREATEST(COALESCE(p_radius_meters, 20), 1), 100)
    AND NOT EXISTS (
      SELECT 1
      FROM public.friends AS f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.receiver_id = ul.user_id)
          OR (f.receiver_id = auth.uid() AND f.requester_id = ul.user_id)
        )
    )
  ORDER BY d.distance_meters
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.find_nearby_users(double precision, double precision, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_nearby_users(double precision, double precision, integer) TO authenticated, service_role;

-- Tables flagged by Supabase Security Advisor in the legacy project.
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Remove the overly broad legacy grants first, then add only operations used by clients.
REVOKE ALL ON TABLE public.friends, public.messages, public.otp_tokens,
  public.user_locations, public.users FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.friends TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO authenticated;

-- OTP rows contain authentication secrets and are server-only.
-- service_role/postgres keep their existing access; no client RLS policy is created.

CREATE POLICY "users_select_own"
ON public.users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "users_insert_own"
ON public.users FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own"
ON public.users FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "users_admin_select"
ON public.users FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "users_admin_update"
ON public.users FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "friends_select_participants"
ON public.friends FOR SELECT TO authenticated
USING (requester_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());

CREATE POLICY "friends_insert_requester"
ON public.friends FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid()
  AND receiver_id IS NOT NULL
  AND receiver_id <> auth.uid()
  AND status = 'pending'
);

CREATE POLICY "friends_accept_receiver"
ON public.friends FOR UPDATE TO authenticated
USING (receiver_id = auth.uid() AND status = 'pending')
WITH CHECK (receiver_id = auth.uid() AND status = 'accepted');

CREATE POLICY "friends_delete_participants"
ON public.friends FOR DELETE TO authenticated
USING (requester_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "messages_select_participants"
ON public.messages FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.conversations AS c
    WHERE c.id = messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

CREATE POLICY "messages_insert_participants"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations AS c
    WHERE c.id = messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

CREATE POLICY "messages_mark_read_recipient"
ON public.messages FOR UPDATE TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations AS c
    WHERE c.id = messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations AS c
    WHERE c.id = messages.conversation_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

CREATE POLICY "locations_select_own_or_friend"
ON public.user_locations FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.friends AS f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.receiver_id = user_locations.user_id)
        OR (f.receiver_id = auth.uid() AND f.requester_id = user_locations.user_id)
      )
  )
);

CREATE POLICY "locations_insert_own"
ON public.user_locations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "locations_update_own"
ON public.user_locations FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "locations_delete_own"
ON public.user_locations FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Admin dashboard access, without embedding a service-role key in Flutter.
CREATE POLICY "reports_admin_select"
ON public.reports FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "reports_admin_update"
ON public.reports FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "announcements_admin_all"
ON public.system_announcements FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "config_admin_update"
ON public.system_config FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "conversations_admin_select"
ON public.conversations FOR SELECT TO authenticated
USING (public.is_admin());

-- Prevent duplicate reverse-direction friendships and speed up common queries.
CREATE UNIQUE INDEX IF NOT EXISTS friends_unordered_pair_uidx
  ON public.friends (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx
  ON public.users (lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS friends_requester_status_idx
  ON public.friends (requester_id, status);
CREATE INDEX IF NOT EXISTS friends_receiver_status_idx
  ON public.friends (receiver_id, status);
CREATE INDEX IF NOT EXISTS conversations_user1_recent_idx
  ON public.conversations (user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user2_recent_idx
  ON public.conversations (user2_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_time_idx
  ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (conversation_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS user_locations_sharing_time_idx
  ON public.user_locations (is_sharing, updated_at DESC);
CREATE INDEX IF NOT EXISTS moments_user_time_idx
  ON public.moments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reactions_moment_time_idx
  ON public.moment_reactions (moment_id, created_at DESC);

-- Recreate the two application buckets when bootstrapping a clean project.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true), ('moments', 'moments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Authenticated users can upload moments" ON storage.objects;
CREATE POLICY "moments_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'moments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "moments_update_own_folder"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'moments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'moments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "moments_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'moments' AND (storage.foldername(name))[1] = auth.uid()::text);

