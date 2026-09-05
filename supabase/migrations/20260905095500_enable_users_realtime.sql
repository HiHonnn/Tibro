-- The mobile client subscribes to profile/session updates on public.users.
-- Keep this idempotent so it is safe for restored and fresh environments.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'users'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.users';
  END IF;
END
$$;
