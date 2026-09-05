SET local check_function_bodies = off;

CREATE TABLE "public"."admins" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admins_pkey" PRIMARY KEY (id),
  CONSTRAINT "admins_user_id_key" UNIQUE (user_id)
);

ALTER TABLE "public"."admins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."bump_signals" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "from_user_id" uuid                     NOT NULL,
  "to_user_id"   uuid                     NOT NULL,
  "bumped_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "bump_signals_from_user_id_to_user_id_key" UNIQUE (from_user_id, to_user_id),
  CONSTRAINT "bump_signals_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."bump_signals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."call_signals" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "caller_id"     uuid                     NOT NULL,
  "receiver_id"   uuid                     NOT NULL,
  "caller_name"   text                     NOT NULL DEFAULT ''::text,
  "caller_avatar" text                     DEFAULT ''::text,
  "call_id"       text                     NOT NULL,
  "is_video"      boolean                  DEFAULT false,
  "created_at"    timestamp with time zone DEFAULT now(),
  "status"        text                     DEFAULT 'ringing'::text,
  CONSTRAINT "call_signals_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."conversations" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user1_id"         uuid,
  "user2_id"         uuid,
  "last_message"     text,
  "last_message_at"  timestamp with time zone,
  "created_at"       timestamp with time zone DEFAULT now(),
  "user1_nickname"   text,
  "user2_nickname"   text,
  "user1_mute"       boolean                  DEFAULT false,
  "user2_mute"       boolean                  DEFAULT false,
  "user1_cleared_at" timestamp with time zone,
  "user2_cleared_at" timestamp with time zone,
  CONSTRAINT "conversations_pkey" PRIMARY KEY (id),
  CONSTRAINT "conversations_user1_id_user2_id_key" UNIQUE (user1_id, user2_id)
);

ALTER TABLE "public"."conversations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."friendship_intimacy" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id_1"      uuid                     NOT NULL,
  "user_id_2"      uuid                     NOT NULL,
  "score"          integer                  NOT NULL DEFAULT 0,
  "last_bumped_at" timestamp with time zone,
  "updated_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "friendship_intimacy_check" CHECK ((user_id_1 <> user_id_2)),
  CONSTRAINT "friendship_intimacy_pkey" PRIMARY KEY (id),
  CONSTRAINT "friendship_intimacy_user_id_1_user_id_2_key" UNIQUE (user_id_1, user_id_2)
);

ALTER TABLE "public"."friendship_intimacy"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."friends" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "requester_id" uuid,
  "receiver_id"  uuid,
  "status"       text                     DEFAULT 'pending'::text,
  "created_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "friends_pkey" PRIMARY KEY (id),
  CONSTRAINT "friends_requester_id_receiver_id_key" UNIQUE (requester_id, receiver_id),
  CONSTRAINT "friends_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text])))
);

CREATE TABLE "public"."location_history" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid,
  "latitude"   double precision         NOT NULL,
  "longitude"  double precision         NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "location_history_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."location_history"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."map_pops" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "sender_id"   uuid,
  "receiver_id" uuid,
  "emoji"       text                     NOT NULL,
  "count"       integer                  NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "is_seen"     boolean                  DEFAULT false,
  CONSTRAINT "map_pops_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."map_pops"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."messages" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" uuid,
  "sender_id"       uuid,
  "content"         text                     NOT NULL,
  "created_at"      timestamp with time zone DEFAULT now(),
  "is_read"         boolean                  DEFAULT false,
  CONSTRAINT "messages_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."moment_reactions" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "moment_id"  uuid,
  "user_id"    uuid,
  "emoji"      text                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "moment_reactions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."moment_reactions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."moments" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "user_id"    uuid,
  "image_url"  text                     NOT NULL,
  "latitude"   double precision         NOT NULL,
  "longitude"  double precision         NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "caption"    text,
  CONSTRAINT "moments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."moments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notifications" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "actor_id"   uuid                     NOT NULL,
  "type"       text                     NOT NULL,
  "data"       jsonb                    DEFAULT '{}'::jsonb,
  "is_read"    boolean                  DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."otp_tokens" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "email"      text                     NOT NULL,
  "otp"        text                     NOT NULL,
  "type"       text                     NOT NULL DEFAULT 'signup'::text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "otp_tokens_email_type_key" UNIQUE (email, TYPE),
  CONSTRAINT "otp_tokens_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."reports" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "reporter_id"      uuid                     NOT NULL,
  "reported_user_id" uuid                     NOT NULL,
  "reason"           text                     NOT NULL,
  "description"      text,
  "status"           text                     NOT NULL DEFAULT 'pending'::text,
  "admin_note"       text,
  "resolved_at"      timestamp with time zone,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "reports_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

ALTER TABLE "public"."reports"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."system_announcements" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"      text                     NOT NULL,
  "message"    text                     NOT NULL,
  "type"       text                     NOT NULL DEFAULT 'info'::text,
  "is_active"  boolean                  DEFAULT true,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "system_announcements_pkey" PRIMARY KEY (id),
  CONSTRAINT "system_announcements_type_check" CHECK ((type = ANY (ARRAY['info'::text, 'warning'::text, 'update'::text, 'event'::text])))
);

ALTER TABLE "public"."system_announcements"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."system_config" (
  "key"        text                     NOT NULL,
  "value"      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "system_config_pkey" PRIMARY KEY (key)
);

ALTER TABLE "public"."system_config"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_locations" (
  "user_id"    uuid                     NOT NULL,
  "latitude"   double precision,
  "longitude"  double precision,
  "is_sharing" boolean                  DEFAULT true,
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_locations_pkey" PRIMARY KEY (user_id)
);

CREATE TABLE "public"."users" (
  "id"            uuid                     NOT NULL,
  "name"          text,
  "email"         text,
  "avatar"        text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "username"      text,
  "online_at"     timestamp with time zone,
  "session_token" text,
  "gender"        text,
  "birthday"      text,
  "is_banned"     boolean                  DEFAULT false,
  CONSTRAINT "users_pkey" PRIMARY KEY (id),
  CONSTRAINT "users_username_unique" UNIQUE (username)
);

CREATE OR REPLACE FUNCTION public.delete_old_call_signals()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  DELETE FROM call_signals WHERE created_at < now() - interval '1 minute';
  RETURN NEW;
END;
$function$;

ALTER TABLE "public"."admins"
  ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."bump_signals"
  ADD CONSTRAINT "bump_signals_from_user_id_fkey" FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."bump_signals"
  ADD CONSTRAINT "bump_signals_to_user_id_fkey" FOREIGN KEY (to_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."conversations"
  ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY (user1_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."conversations"
  ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY (user2_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."friends"
  ADD CONSTRAINT "friends_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."friends"
  ADD CONSTRAINT "friends_requester_id_fkey" FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."friendship_intimacy"
  ADD CONSTRAINT "friendship_intimacy_user_id_1_fkey" FOREIGN KEY (user_id_1) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."friendship_intimacy"
  ADD CONSTRAINT "friendship_intimacy_user_id_2_fkey" FOREIGN KEY (user_id_2) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."location_history"
  ADD CONSTRAINT "location_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."moment_reactions"
  ADD CONSTRAINT "moment_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."moment_reactions"
  ADD CONSTRAINT "moment_reactions_moment_id_fkey" FOREIGN KEY (moment_id) REFERENCES public.moments(id) ON DELETE CASCADE;

ALTER TABLE "public"."moments"
  ADD CONSTRAINT "moments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_locations"
  ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."map_pops"
  ADD CONSTRAINT "map_pops_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."map_pops"
  ADD CONSTRAINT "map_pops_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."reports"
  ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."reports"
  ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."system_announcements"
  ADD CONSTRAINT "system_announcements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX announcements_created_at_idx ON public.system_announcements USING btree (created_at DESC);

CREATE INDEX idx_bump_to ON public.bump_signals USING btree (to_user_id, bumped_at DESC);

CREATE INDEX idx_intimacy_user1 ON public.friendship_intimacy USING btree (user_id_1);

CREATE INDEX idx_intimacy_user2 ON public.friendship_intimacy USING btree (user_id_2);

CREATE INDEX idx_location_history_user_time ON public.location_history USING btree (user_id, created_at DESC);

CREATE INDEX idx_notif_unread ON public.notifications USING btree (user_id, is_read)
  WHERE (is_read = false);

CREATE INDEX idx_notif_user ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX reports_reported_idx ON public.reports USING btree (reported_user_id);

CREATE INDEX reports_reporter_idx ON public.reports USING btree (reporter_id);

CREATE INDEX reports_status_idx ON public.reports USING btree (status);

CREATE INDEX users_is_banned_idx ON public.users USING btree (is_banned);

CREATE TRIGGER cleanup_call_signals
  AFTER INSERT ON public.call_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_old_call_signals();

CREATE POLICY "Users can check own admin status" ON "public"."admins"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "bump_all" ON "public"."bump_signals"
  FOR ALL
  TO PUBLIC
  USING ((auth.uid() = from_user_id));

CREATE POLICY "bump_select" ON "public"."bump_signals"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = from_user_id) OR (auth.uid() = to_user_id)));

CREATE POLICY "conversations_insert" ON "public"."conversations"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));

CREATE POLICY "conversations_select" ON "public"."conversations"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));

CREATE POLICY "conversations_update" ON "public"."conversations"
  FOR UPDATE
  TO PUBLIC
  USING (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));

CREATE POLICY "intimacy_all" ON "public"."friendship_intimacy"
  FOR ALL
  TO PUBLIC
  USING (((auth.uid() = user_id_1) OR (auth.uid() = user_id_2)));

CREATE POLICY "intimacy_select" ON "public"."friendship_intimacy"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = user_id_1) OR (auth.uid() = user_id_2)));

CREATE POLICY "Friends can read each other history" ON "public"."location_history"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.friends
  WHERE
    ((friends.status = 'accepted'::text) AND (((friends.requester_id = auth.uid()) AND (friends.receiver_id = location_history.user_id)) OR ((friends.receiver_id = auth.uid()) AND
    (friends.requester_id = location_history.user_id)))))));

CREATE POLICY "Users can delete their own history" ON "public"."location_history"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "Users can insert their own history" ON "public"."location_history"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "Users can read their own history" ON "public"."location_history"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "Cap nhat pops" ON "public"."map_pops"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = receiver_id));

CREATE POLICY "Cho phép người dùng tạo pops" ON "public"."map_pops"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = sender_id));

CREATE POLICY "Cho phép người nhận đánh dấu đã xem" ON "public"."map_pops"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = receiver_id));

CREATE POLICY "Cho phép xem pops của mình" ON "public"."map_pops"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = receiver_id) OR (auth.uid() = sender_id)));

CREATE POLICY "Cho phép xóa pops của mình" ON "public"."map_pops"
  FOR DELETE
  TO PUBLIC
  USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));

CREATE POLICY "Tao pops" ON "public"."map_pops"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = sender_id));

CREATE POLICY "Xem pops" ON "public"."map_pops"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = receiver_id) OR (auth.uid() = sender_id)));

CREATE POLICY "Xoa pops" ON "public"."map_pops"
  FOR DELETE
  TO PUBLIC
  USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));

CREATE POLICY "Ai cũng có thể đọc reaction" ON "public"."moment_reactions"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "User có thể gửi reaction" ON "public"."moment_reactions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Friends can read each other moments" ON "public"."moments"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.friends
  WHERE
    ((friends.status = 'accepted'::text) AND (((friends.requester_id = auth.uid()) AND (friends.receiver_id = moments.user_id)) OR ((friends.receiver_id = auth.uid()) AND
    (friends.requester_id = moments.user_id))))))));

CREATE POLICY "Users can insert their own moments" ON "public"."moments"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "notif_insert" ON "public"."notifications"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = actor_id));

CREATE POLICY "notif_select" ON "public"."notifications"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "notif_update" ON "public"."notifications"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "User can create report" ON "public"."reports"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((reporter_id = auth.uid()));

CREATE POLICY "User can read own reports" ON "public"."reports"
  FOR SELECT
  TO "authenticated"
  USING ((reporter_id = auth.uid()));

CREATE POLICY "Anyone can read active announcements" ON "public"."system_announcements"
  FOR SELECT
  TO PUBLIC
  USING ((is_active = true));

CREATE POLICY "Anyone can read config" ON "public"."system_config"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Anyone can view moments" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'moments'::text));

CREATE POLICY "Authenticated users can upload moments" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'moments'::text));

CREATE POLICY "Secure_Delete_Avatar" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Secure_Insert_Avatar" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Secure_Select_Avatar" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'avatars'::text));

CREATE POLICY "Secure_Update_Avatar" ON "storage"."objects"
  FOR UPDATE
  TO "authenticated"
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."bump_signals";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."call_signals";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."friendship_intimacy";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."friends";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."map_pops";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."messages";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."moment_reactions";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."notifications";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."reports";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."user_locations";

GRANT EXECUTE ON FUNCTION "public"."delete_old_call_signals"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admins" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."bump_signals" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."call_signals" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."conversations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."friends" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."friendship_intimacy" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."location_history" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."map_pops" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."moment_reactions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."moments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."otp_tokens" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reports" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."system_announcements" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."system_config" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_locations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."users" TO "anon", "authenticated", "postgres", "service_role";

