# Repository Guidelines

## Project Structure & Module Organization

The application is a Svelte 5 and TypeScript SPA. Views live in `src/pages/`, reusable UI in `src/components/`, and helpers in `src/lib/`. Global styles are in `src/app.css`; static assets and the Cloudflare Pages redirect rule are under `public/`. Supabase migrations live in `supabase/migrations/`, and the registration Edge Function is in `supabase/functions/register/`. Keep planning notes in `plans/`. Product copy remains Portuguese (`pt-PT`).

## Build, Test, and Development Commands

- `npm ci` installs the exact dependency versions from `package-lock.json`.
- `npm run dev` starts the Vite development server.
- `npm run check` runs `svelte-check` and both TypeScript configurations.
- `npm run build` creates the static production bundle in `dist/`.
- `npm run preview` serves that bundle for final local verification.
- `npx supabase functions serve register --env-file supabase/functions/.env` runs the registration function locally; never commit that environment file.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and semicolons in application TypeScript. Name Svelte components in PascalCase (`PinForm.svelte`), functions and variables in camelCase, and SQL migrations with timestamped snake-case names. Write code identifiers, comments, logs, and developer documentation in English; reserve Portuguese (`pt-PT`) for user-facing copy. Prefer explicit TypeScript types at external boundaries. Use Svelte 5 runes consistently, and initialize and destroy Leaflet instances through component lifecycle hooks. No ESLint or Prettier configuration is currently present; `npm run check` is the authoritative static check.

## Testing Guidelines

There is no automated test runner or coverage threshold yet. Before submitting changes, run `npm run check` and `npm run build`. For affected flows, manually verify the public map and list, registration, `/gerir/{uuid}`, and pin creation, editing, and deletion. If introducing a test runner, colocate unit tests as `*.test.ts` and add its command to `package.json` and this guide.

## Commit & Pull Request Guidelines

Use concise, imperative English commit subjects and optional explanatory bodies. Keep commits focused. Pull requests should explain the behavior change, list validation performed, link relevant issues, and include screenshots for visible UI changes. Call out migrations, RPC changes, or new environment variables explicitly.

## Security & Configuration

Never expose Supabase service-role or Resend secrets in client code or Git. The Vite configuration explicitly exposes only `SUPABASE_URL` and `SUPABASE_ANON_KEY`, with placeholders documented in `.env.example`; do not broaden that allowlist. Preserve the RPC/RLS security boundary: public pin responses must never expose `pins.user_id`, because it is also the persistent management credential.
