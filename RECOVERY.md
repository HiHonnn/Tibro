# Tibro recovery checklist

This file records the remaining work required to turn the restored codebase into a deployable portfolio project.

## Baseline completed

- Removed the obsolete Zego call implementation and its native dependencies.
- Removed duplicate/generated project folders and unused Firebase files.
- Moved mobile and backend secrets to environment variables.
- Removed the Supabase service-role key from the Flutter admin client.
- Secured the custom password-reset endpoint so an OTP is required.
- Restored persistent mobile session storage with AsyncStorage.
- Fixed current TypeScript and ESLint errors/warnings.
- Imported the legacy remote schema into `supabase/migrations/20260904134033_remote_schema.sql`.
- Added a separate hardening migration and verified it against a clean local Supabase database.
- Added safe demo seed data and reproducible local-development configuration.
- Restored one-to-one voice/video calling with LiveKit, authenticated backend token issuance, Supabase call state, incoming-call UI, decline, timeout, and disconnect handling.
- Moved intimacy scoring, Moment reaction notifications, Pop notifications, and Bump proximity validation into trusted database functions/triggers.
- Replaced duplicate profile/location hook instances with shared providers so the app runs one presence timer and one GPS watcher.

## Required before running

1. Rotate every credential that was previously committed: Supabase service-role key, Gmail app password, Google Maps key, and Zego credentials.
2. Copy `.env.example` to `.env` and enter the new public mobile values.
3. Copy `functions/.env.example` to `functions/.env` and enter server-only values. Never expose the service-role key to a client application.
4. Start the auth service from `functions` with `npm install` and `npm run dev`.
5. Start the Expo app from the repository root with `npm install` and `npm start`.
6. Run the Flutter admin app with public configuration only:

   ```text
   flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
   ```

Voice/video calling additionally requires `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET` in `functions/.env`, followed by a new native development build.

## Database recovery

The repository now contains a reproducible schema:

- `20260904134033_remote_schema.sql` is the untouched snapshot of the old project.
- `20260904150000_harden_legacy_schema.sql` removes obsolete call signalling, enables RLS on every public table, restricts OTP data to the backend, adds admin policies, creates safe profile/nearby RPCs, creates storage buckets, and adds indexes.
- `20260905150000_add_secure_call_sessions.sql` adds participant-only call signalling, realtime updates, and database-level prevention of concurrent calls for the same account.
- `20260905151000_secure_client_interactions.sql` moves scoring/notifications/Bump validation into trusted database code, tightens chat/Moment/Pop/location policies, and creates the `chat-images` bucket.
- `seed.sql` contains public fake data only.

### Verify locally

Docker Desktop must be running. From the repository root:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset
npx.cmd supabase db lint --local --level warning
```

Supabase Studio is then available at `http://127.0.0.1:54323`. Stop the local stack with:

```powershell
npx.cmd supabase stop
```

### Deploy to the clean portfolio project

Do not push these migrations back to the legacy project. Obtain the **new** project reference from
`Project Settings > General`, then run:

```powershell
npx.cmd supabase link --project-ref YOUR_NEW_PROJECT_REF
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

After deployment:

1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` from the new project.
2. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `functions/.env`; never put the service-role key in Expo or Flutter.
3. In Supabase Auth settings, keep email sign-up enabled, set minimum password length to 8, and disable email confirmation only while the custom OTP registration flow is retained.
4. Add the intended admin user's Auth UUID to `public.admins` through the SQL editor or a trusted server process.
5. Run the app's sign-up, login, friend, chat, location-sharing, radar, moment, report, and admin flows against the new project.

The old project remains the data reference/backup. Use fake accounts in the portfolio project; do not copy old OTP rows, sessions, or real locations.

## Calling deployment note

The replacement uses LiveKit/WebRTC and a development build. Provider secrets and
token-signing keys must remain in the Node.js environment. Incoming calls are handled
while the app is active; production background ringing still requires a push-notification
provider and native call integration.

## Portfolio-quality follow-up

- Add unit tests for authentication and call authorization.
- Add integration tests for sign-up, password recovery, chat, and location-sharing privacy.
- Add CI for type checking, linting, backend checks, and tests.
- Replace the placeholder documentation with architecture, setup, screenshots, API contracts, and a short threat model.
