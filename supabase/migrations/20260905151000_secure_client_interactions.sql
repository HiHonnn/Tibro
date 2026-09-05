-- Move trust-sensitive client interactions into Postgres.
-- This makes intimacy scoring atomic, restricts reactions/pops to friends, and
-- enforces location-history privacy in RLS instead of using sentinel coordinates.

CREATE TABLE public.location_history_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  sharing_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_history_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.location_history_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.location_history_preferences TO authenticated;

CREATE POLICY "history_preferences_own"
ON public.location_history_preferences FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Preserve existing opt-outs recorded by the legacy sentinel mechanism.
INSERT INTO public.location_history_preferences (user_id, sharing_enabled)
SELECT DISTINCT user_id, false
FROM public.location_history
WHERE latitude = 89.9999
ON CONFLICT (user_id) DO UPDATE
SET sharing_enabled = false, updated_at = now();

DELETE FROM public.location_history WHERE latitude = 89.9999;

DROP POLICY IF EXISTS "Users can insert their own history" ON public.location_history;
CREATE POLICY "users_insert_valid_history"
ON public.location_history FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND latitude BETWEEN -90 AND 90
  AND longitude BETWEEN -180 AND 180
);

DROP POLICY IF EXISTS "Friends can read each other history" ON public.location_history;
CREATE POLICY "friends_read_shared_history"
ON public.location_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.friends AS f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = auth.uid() AND f.receiver_id = location_history.user_id)
        OR (f.receiver_id = auth.uid() AND f.requester_id = location_history.user_id)
      )
  )
  AND COALESCE(
    (SELECT p.sharing_enabled
     FROM public.location_history_preferences AS p
     WHERE p.user_id = location_history.user_id),
    false
  )
);

-- Conversation creation is limited to accepted friendships.
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;
CREATE POLICY "conversations_insert_friends"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IN (user1_id, user2_id)
  AND user1_id < user2_id
  AND EXISTS (
    SELECT 1 FROM public.friends AS f
    WHERE f.status = 'accepted'
      AND LEAST(f.requester_id, f.receiver_id) = user1_id
      AND GREATEST(f.requester_id, f.receiver_id) = user2_id
  )
);

DROP POLICY IF EXISTS "messages_insert_participants" ON public.messages;
CREATE POLICY "messages_insert_friends"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND char_length(content) BETWEEN 1 AND 5000
  AND EXISTS (
    SELECT 1 FROM public.conversations AS c
    WHERE c.id = messages.conversation_id
      AND auth.uid() IN (c.user1_id, c.user2_id)
      AND EXISTS (
        SELECT 1 FROM public.friends AS f
        WHERE f.status = 'accepted'
          AND LEAST(f.requester_id, f.receiver_id) = c.user1_id
          AND GREATEST(f.requester_id, f.receiver_id) = c.user2_id
      )
  )
);

-- Clients may read intimacy but cannot directly choose their own score.
DROP POLICY IF EXISTS "intimacy_all" ON public.friendship_intimacy;
DROP POLICY IF EXISTS "intimacy_select" ON public.friendship_intimacy;
REVOKE ALL ON TABLE public.friendship_intimacy FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.friendship_intimacy TO authenticated;
CREATE POLICY "intimacy_select_participants"
ON public.friendship_intimacy FOR SELECT TO authenticated
USING (user_id_1 = auth.uid() OR user_id_2 = auth.uid());

CREATE TABLE public.intimacy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('chat', 'reaction')),
  source_id uuid NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, source_id)
);

ALTER TABLE public.intimacy_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.intimacy_events FROM PUBLIC, anon, authenticated;
CREATE INDEX intimacy_events_daily_idx
  ON public.intimacy_events (actor_id, friend_id, event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_intimacy_event(
  p_actor_id uuid,
  p_friend_id uuid,
  p_event_type text,
  p_source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_points integer;
  v_daily_limit integer;
  v_today_start timestamptz;
  v_inserted integer;
  v_user_1 uuid := LEAST(p_actor_id, p_friend_id);
  v_user_2 uuid := GREATEST(p_actor_id, p_friend_id);
BEGIN
  IF p_actor_id IS NULL OR p_friend_id IS NULL OR p_actor_id = p_friend_id THEN RETURN; END IF;
  IF p_event_type = 'chat' THEN v_points := 1; v_daily_limit := 20;
  ELSIF p_event_type = 'reaction' THEN v_points := 5; v_daily_limit := 5;
  ELSE RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friends AS f
    WHERE f.status = 'accepted'
      AND LEAST(f.requester_id, f.receiver_id) = v_user_1
      AND GREATEST(f.requester_id, f.receiver_id) = v_user_2
  ) THEN RETURN; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_actor_id::text || p_friend_id::text || p_event_type ||
    (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text,
    0
  ));
  v_today_start := ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::timestamp
                    AT TIME ZONE 'Asia/Ho_Chi_Minh');

  IF (SELECT count(*) FROM public.intimacy_events
      WHERE actor_id = p_actor_id AND friend_id = p_friend_id
        AND event_type = p_event_type AND created_at >= v_today_start) >= v_daily_limit THEN
    RETURN;
  END IF;

  INSERT INTO public.intimacy_events (actor_id, friend_id, event_type, source_id, points)
  VALUES (p_actor_id, p_friend_id, p_event_type, p_source_id, v_points)
  ON CONFLICT (event_type, source_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN RETURN; END IF;

  INSERT INTO public.friendship_intimacy (user_id_1, user_id_2, score, updated_at)
  VALUES (v_user_1, v_user_2, v_points, now())
  ON CONFLICT (user_id_1, user_id_2) DO UPDATE
  SET score = public.friendship_intimacy.score + EXCLUDED.score,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.apply_intimacy_event(uuid, uuid, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.score_message_intimacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_friend_id uuid;
BEGIN
  SELECT CASE WHEN c.user1_id = NEW.sender_id THEN c.user2_id ELSE c.user1_id END
  INTO v_friend_id
  FROM public.conversations AS c
  WHERE c.id = NEW.conversation_id
    AND NEW.sender_id IN (c.user1_id, c.user2_id);
  PERFORM public.apply_intimacy_event(NEW.sender_id, v_friend_id, 'chat', NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS score_message_intimacy_trigger ON public.messages;
CREATE TRIGGER score_message_intimacy_trigger
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.score_message_intimacy();

CREATE OR REPLACE FUNCTION public.update_conversation_preview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content, last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR last_message_at <= NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_conversation_preview_trigger ON public.messages;
CREATE TRIGGER update_conversation_preview_trigger
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_preview();

-- Reaction visibility follows the associated Moment, and only friends may react.
DROP POLICY IF EXISTS "Ai cũng có thể đọc reaction" ON public.moment_reactions;
DROP POLICY IF EXISTS "User có thể gửi reaction" ON public.moment_reactions;
REVOKE ALL ON TABLE public.moment_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.moment_reactions TO authenticated;

CREATE POLICY "reactions_select_visible_moment"
ON public.moment_reactions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.moments AS m
    WHERE m.id = moment_reactions.moment_id
      AND (
        m.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends AS f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.receiver_id = m.user_id)
              OR (f.receiver_id = auth.uid() AND f.requester_id = m.user_id))
        )
      )
  )
);

CREATE POLICY "reactions_insert_visible_moment"
ON public.moment_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND char_length(emoji) BETWEEN 1 AND 16
  AND EXISTS (
    SELECT 1 FROM public.moments AS m
    WHERE m.id = moment_reactions.moment_id
      AND (
        m.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friends AS f
          WHERE f.status = 'accepted'
            AND ((f.requester_id = auth.uid() AND f.receiver_id = m.user_id)
              OR (f.receiver_id = auth.uid() AND f.requester_id = m.user_id))
        )
      )
  )
);

DROP POLICY IF EXISTS "Users can insert their own moments" ON public.moments;
CREATE POLICY "users_insert_valid_moments"
ON public.moments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND latitude BETWEEN -90 AND 90
  AND longitude BETWEEN -180 AND 180
  AND char_length(image_url) BETWEEN 1 AND 2048
  AND char_length(COALESCE(caption, '')) <= 50
);

CREATE OR REPLACE FUNCTION public.process_moment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid;
  v_image_url text;
  v_caption text;
BEGIN
  SELECT user_id, image_url, caption INTO v_owner_id, v_image_url, v_caption
  FROM public.moments WHERE id = NEW.moment_id;
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN RETURN NEW; END IF;

  PERFORM public.apply_intimacy_event(NEW.user_id, v_owner_id, 'reaction', NEW.id);
  INSERT INTO public.notifications (user_id, actor_id, type, data)
  VALUES (v_owner_id, NEW.user_id, 'moment_reaction', jsonb_build_object(
    'emoji', NEW.emoji, 'moment_id', NEW.moment_id,
    'moment_owner_id', v_owner_id, 'image_url', v_image_url, 'caption', v_caption
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_moment_reaction_trigger ON public.moment_reactions;
CREATE TRIGGER process_moment_reaction_trigger
AFTER INSERT ON public.moment_reactions
FOR EACH ROW EXECUTE FUNCTION public.process_moment_reaction();

-- Pops are friend-only, bounded, and produce their notification server-side.
DROP POLICY IF EXISTS "Cap nhat pops" ON public.map_pops;
DROP POLICY IF EXISTS "Cho phép người dùng tạo pops" ON public.map_pops;
DROP POLICY IF EXISTS "Cho phép người nhận đánh dấu đã xem" ON public.map_pops;
DROP POLICY IF EXISTS "Cho phép xem pops của mình" ON public.map_pops;
DROP POLICY IF EXISTS "Cho phép xóa pops của mình" ON public.map_pops;
DROP POLICY IF EXISTS "Tao pops" ON public.map_pops;
DROP POLICY IF EXISTS "Xem pops" ON public.map_pops;
DROP POLICY IF EXISTS "Xoa pops" ON public.map_pops;
REVOKE ALL ON TABLE public.map_pops FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_pops TO authenticated;

CREATE POLICY "pops_select_participants" ON public.map_pops FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "pops_insert_friends" ON public.map_pops FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid() AND receiver_id <> auth.uid()
  AND count BETWEEN 1 AND 100 AND char_length(emoji) BETWEEN 1 AND 16
  AND EXISTS (
    SELECT 1 FROM public.friends AS f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = auth.uid() AND f.receiver_id = map_pops.receiver_id)
        OR (f.receiver_id = auth.uid() AND f.requester_id = map_pops.receiver_id))
  )
);
CREATE POLICY "pops_update_receiver" ON public.map_pops FOR UPDATE TO authenticated
USING (receiver_id = auth.uid()) WITH CHECK (receiver_id = auth.uid());
CREATE POLICY "pops_delete_participants" ON public.map_pops FOR DELETE TO authenticated
USING (sender_id = auth.uid() OR receiver_id = auth.uid());

REVOKE UPDATE ON TABLE public.map_pops FROM authenticated;
GRANT UPDATE (is_seen) ON TABLE public.map_pops TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_map_pop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, data)
  VALUES (NEW.receiver_id, NEW.sender_id, 'emoji_pop',
          jsonb_build_object('emoji', NEW.emoji, 'count', NEW.count));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_map_pop_trigger ON public.map_pops;
CREATE TRIGGER notify_map_pop_trigger
AFTER INSERT ON public.map_pops
FOR EACH ROW EXECUTE FUNCTION public.notify_map_pop();

-- Notifications are emitted by trusted triggers/RPCs, never fabricated by clients.
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
REVOKE INSERT, UPDATE ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;

-- Prevent recipients from editing message contents and users from editing
-- moderation fields on their own profile.
REVOKE UPDATE ON TABLE public.messages FROM authenticated;
GRANT UPDATE (is_read) ON TABLE public.messages TO authenticated;
REVOKE UPDATE ON TABLE public.friends FROM authenticated;
GRANT UPDATE (status) ON TABLE public.friends TO authenticated;
REVOKE UPDATE ON TABLE public.users FROM authenticated;
GRANT UPDATE (name, avatar, username, online_at, session_token, gender, birthday, is_banned)
  ON TABLE public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_user_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'only administrators can change ban status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_moderation_fields_trigger ON public.users;
CREATE TRIGGER protect_user_moderation_fields_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_moderation_fields();

CREATE OR REPLACE FUNCTION public.protect_conversation_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.user1_id IS DISTINCT FROM OLD.user1_id OR NEW.user2_id IS DISTINCT FROM OLD.user2_id THEN
    RAISE EXCEPTION 'conversation participants cannot be changed';
  END IF;
  IF auth.uid() = OLD.user1_id AND (
    NEW.user2_nickname IS DISTINCT FROM OLD.user2_nickname
    OR NEW.user2_mute IS DISTINCT FROM OLD.user2_mute
    OR NEW.user2_cleared_at IS DISTINCT FROM OLD.user2_cleared_at
  ) THEN RAISE EXCEPTION 'cannot change another participant settings'; END IF;
  IF auth.uid() = OLD.user2_id AND (
    NEW.user1_nickname IS DISTINCT FROM OLD.user1_nickname
    OR NEW.user1_mute IS DISTINCT FROM OLD.user1_mute
    OR NEW.user1_cleared_at IS DISTINCT FROM OLD.user1_cleared_at
  ) THEN RAISE EXCEPTION 'cannot change another participant settings'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_conversation_participants_trigger ON public.conversations;
CREATE TRIGGER protect_conversation_participants_trigger
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_participants();

REVOKE UPDATE ON TABLE public.conversations FROM authenticated;
GRANT UPDATE (user1_nickname, user2_nickname, user1_mute, user2_mute,
              user1_cleared_at, user2_cleared_at)
  ON TABLE public.conversations TO authenticated;

CREATE OR REPLACE FUNCTION public.perform_secure_bump(p_friend_id uuid)
RETURNS TABLE (success boolean, new_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_user_1 uuid := LEAST(v_me, p_friend_id);
  v_user_2 uuid := GREATEST(v_me, p_friend_id);
  v_me_lat double precision;
  v_me_lng double precision;
  v_friend_lat double precision;
  v_friend_lng double precision;
  v_last_bump timestamptz;
  v_score integer;
  v_distance double precision;
BEGIN
  IF v_me IS NULL OR p_friend_id IS NULL OR v_me = p_friend_id THEN
    RAISE EXCEPTION 'invalid bump target';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friends AS f WHERE f.status = 'accepted'
      AND LEAST(f.requester_id, f.receiver_id) = v_user_1
      AND GREATEST(f.requester_id, f.receiver_id) = v_user_2
  ) THEN RAISE EXCEPTION 'friendship required'; END IF;

  SELECT latitude, longitude INTO v_me_lat, v_me_lng
  FROM public.user_locations
  WHERE user_id = v_me AND is_sharing = true AND updated_at >= now() - interval '3 minutes';
  SELECT latitude, longitude INTO v_friend_lat, v_friend_lng
  FROM public.user_locations
  WHERE user_id = p_friend_id AND is_sharing = true AND updated_at >= now() - interval '3 minutes';
  IF v_me_lat IS NULL OR v_friend_lat IS NULL THEN RAISE EXCEPTION 'fresh shared locations required'; END IF;

  v_distance := 6371000.0 * acos(LEAST(1.0, GREATEST(-1.0,
    cos(radians(v_me_lat)) * cos(radians(v_friend_lat))
      * cos(radians(v_friend_lng) - radians(v_me_lng))
      + sin(radians(v_me_lat)) * sin(radians(v_friend_lat))
  )));
  IF v_distance > 50 THEN RAISE EXCEPTION 'users are not nearby'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_1::text || v_user_2::text ||
    (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text, 0));
  INSERT INTO public.friendship_intimacy (user_id_1, user_id_2, score)
  VALUES (v_user_1, v_user_2, 0)
  ON CONFLICT (user_id_1, user_id_2) DO NOTHING;

  SELECT score, last_bumped_at INTO v_score, v_last_bump
  FROM public.friendship_intimacy
  WHERE user_id_1 = v_user_1 AND user_id_2 = v_user_2
  FOR UPDATE;

  IF v_last_bump IS NOT NULL
    AND (v_last_bump AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN QUERY SELECT false, v_score;
    RETURN;
  END IF;

  UPDATE public.friendship_intimacy
  SET score = score + 50, last_bumped_at = now(), updated_at = now()
  WHERE user_id_1 = v_user_1 AND user_id_2 = v_user_2
  RETURNING score INTO v_score;

  INSERT INTO public.notifications (user_id, actor_id, type, data)
  VALUES (p_friend_id, v_me, 'intimacy_bump', jsonb_build_object('points', 50, 'newScore', v_score));
  RETURN QUERY SELECT true, v_score;
END;
$$;

REVOKE ALL ON FUNCTION public.perform_secure_bump(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.perform_secure_bump(uuid) TO authenticated, service_role;

-- Remove legacy table privileges that bypass RLS (notably TRUNCATE/TRIGGER)
-- and grant only the operations used by either the user app or admin app.
REVOKE ALL ON TABLE public.admins, public.bump_signals, public.conversations,
  public.location_history, public.moments, public.notifications, public.reports,
  public.system_announcements, public.system_config FROM anon, authenticated;
GRANT SELECT ON TABLE public.admins TO authenticated;
GRANT SELECT, INSERT ON TABLE public.conversations TO authenticated;
GRANT UPDATE (user1_nickname, user2_nickname, user1_mute, user2_mute,
              user1_cleared_at, user2_cleared_at)
  ON TABLE public.conversations TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.location_history TO authenticated;
GRANT SELECT, INSERT ON TABLE public.moments TO authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (is_read) ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_announcements TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.system_config TO authenticated;
GRANT SELECT ON TABLE public.system_announcements, public.system_config TO anon;

DROP POLICY IF EXISTS "User can create report" ON public.reports;
CREATE POLICY "users_create_valid_reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (
  reporter_id = auth.uid()
  AND reported_user_id <> auth.uid()
  AND char_length(btrim(reason)) BETWEEN 1 AND 100
  AND char_length(COALESCE(description, '')) <= 500
);

-- Chat files have their own bucket instead of being mixed with profile avatars.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY "chat_images_insert_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "chat_images_delete_own_folder"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "chat_images_public_read"
ON storage.objects FOR SELECT TO PUBLIC
USING (bucket_id = 'chat-images');
