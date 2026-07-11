# AGENTS.md

## Cursor Cloud specific instructions

Schedule Assistant is a single product: a React 19 + Vite PWA frontend plus a Cloudflare Worker (Wrangler + a Durable Object `AuthStore`) backend. It helps allocate recurring daily tasks around Google Calendar/Tasks using Gemini. UI and docs are in Japanese. Standard commands live in `package.json` and setup steps in `README.md`; only the non-obvious caveats are below.

### Services (both required to run the app)
- Frontend dev server: `yarn dev` → http://localhost:5173. Per `.cursor/rules/single-dev-server.mdc`, pin it: `yarn dev --host 127.0.0.1 --port 5173 --strictPort`. Do not let Vite auto-increment to 5174+.
- Worker dev server: `yarn worker:dev` → http://localhost:8787. Do not run `wrangler dev` directly; the `scripts/worker-dev.mjs` wrapper loads secrets and enforces the checks below.
- There is no local database. OAuth sessions/PKCE state live in the embedded Durable Object inside the local Wrangler process.

### Secrets / startup gotchas (non-obvious)
- Secrets are read from `$HOME/secrets`, not from the repo. `vite.config.ts` auto-loads `~/secrets/schedule-assistant.env`; `scripts/worker-dev.mjs` loads `~/secrets/schedule-assistant-worker.env`.
- `yarn worker:dev` exits with an error if `~/secrets/schedule-assistant-worker.env` is missing, AND it also refuses to start if the legacy `worker/.dev.vars` file exists. Keep `worker/.dev.vars` deleted.
- `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` can be any long random strings (generate locally). `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (real Google OAuth client with Calendar + Tasks APIs enabled, callback `http://localhost:8787/api/google/callback`) and `GEMINI_API_KEY` (Google AI Studio) are real external credentials.
- `APP_ORIGINS` must include the exact frontend origin(s) used, e.g. `http://localhost:5173,http://127.0.0.1:5173`. CORS + OAuth `returnTo` are rejected for origins not listed. On localhost the session cookie is `SameSite=Lax`; mixing origins/ports breaks the OAuth cookie flow.

### What works without real Google/Gemini credentials
- Worker `GET /api/google/health` → `{"ok":true}` and `GET /api/google/session` → `{"authenticated":false}` respond with only the generated `SESSION_SECRET`/`TOKEN_ENCRYPTION_KEY` set.
- Frontend home page loads (does a live session check against the Worker and shows the Google login button) and the Settings page (`/settings`) loads + parses `public/templates/daily-tasks.md` and renders the template JSON.
- Full end-to-end schedule generation (login → fetch Calendar/Tasks → Gemini) requires the real Google OAuth client and Gemini API key.

### Templates
- The app fetches `public/templates/daily-tasks.md` at runtime. Edit that file directly; there is no separate copy step.

### Checks
- Lint: `yarn lint` (one pre-existing `react-refresh` warning in `ScheduleTimeline.tsx`, 0 errors). Tests: `yarn test` (Vitest). Worker types: `yarn worker:typecheck`. Build: `yarn build`.
