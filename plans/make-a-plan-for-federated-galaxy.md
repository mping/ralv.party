# ralvessura — "Doces ou Travessuras" (mapa de Halloween, pt-PT)

## Context

The repo is empty except for an untracked README.md that defines the idea: a Portuguese-language Halloween trick-or-treat pin map, similar to trickortreatmap.com. People register their house (name, email + Cloudflare Turnstile), receive a magic link by email, and use it to manage pins (name, address, timespan, sweets) that appear on a public map and list. The README constraints: pure client-side, free mapping (Leaflet/OSM), deploy to Vercel/Netlify/Cloudflare, simple database.

**Decisions confirmed with the user:** Svelte 5 + Vite SPA · Supabase (Postgres) · persistent secret-URL magic link (`/gerir/{uuid}`, no expiry — the uuid IS the authority) · Cloudflare Pages.

Note on "pure client-side": the site is a fully static SPA with no app server. One Supabase Edge Function exists for the one thing browsers cannot do — sending the magic-link email (and verifying Turnstile server-side). That is the minimal, unavoidable exception.

## Architecture

```
Browser (Svelte 5 SPA, static on Cloudflare Pages)
 ├─ GET  /                 → Home: public map + list
 ├─ GET  /gerir/{uuid}     → Manage page (secret-URL authority)
 │
 ├─ supabase-js (anon key) ──► Supabase Postgres (RLS; anon only via RPC)
 │    ├─ rpc get_public_pins()          — pins WITHOUT user_id (never leak the secret)
 │    ├─ rpc get_my_data(secret)        — verify secret → user + own pins
 │    ├─ rpc upsert_pin(secret, ...)    — insert or edit, ownership checked
 │    └─ rpc delete_pin(secret, pin_id)
 │
 ├─ functions.invoke('register') ──► Edge Function (Deno)
 │      1. validate  2. Turnstile siteverify (secret server-side)
 │      3. upsert user (uuid generated SERVER-side, service role)
 │      4. email link via Resend
 │
 ├─ photon.komoot.io  — address autocomplete + reverse geocoding (OSM data, CORS)
 └─ CARTO Dark Matter tiles (free, fits Halloween dark theme)
```

**Security model (accepted by design):** `users.id` uuid is the secret; possession of `/gerir/{uuid}` = full control of that user's pins. 122-bit random uuids are unguessable; no sessions, no expiry (per README "can be accessed at any time"). Critical invariant: `pins.user_id` must never be readable by anon — a public SELECT policy on `pins` would leak everyone's manage link. All reads/writes go through SECURITY DEFINER functions.

## Step 0 — Accounts & prerequisites (~30 min, one-time)

1. **Supabase** account → new project (EU region). Save URL + anon key.
2. **Cloudflare** account → **Turnstile** widget: site key + secret; allow hostnames `localhost` (dev) + `ralvessura.pages.dev` (+ custom domain later). Dev test keys: site `1x00000000000000000000AA` (always passes), secret `1x0000000000000000000000000000000AA`.
3. **Resend** account → verify sending domain (DNS in Cloudflare). Until verified, email only goes to the account owner via `onboarding@resend.dev` — enough for testing.
4. Install Supabase CLI as dev dep (`npm i -D supabase`). Docker only needed for full-local `supabase start` (optional; hosted project + `supabase functions serve` works without it).

## Step 1 — Scaffold

```bash
cd /home/mping/Devel/workspace/ralvessura
npm create vite@latest . -- --template svelte-ts
npm install
npm install leaflet @supabase/supabase-js
npm install -D @types/leaflet supabase
```

→ Vite 8, Svelte ^5.57, leaflet ^1.9.4, supabase-js **^2** (v3 still stabilizing). Delete template `Counter.svelte`/assets. No Tailwind, no UI framework — plain CSS variables. `index.html`: `lang="pt-PT"`, title "Doces ou Travessuras". Commit after scaffold.

## File structure (~15 files)

```
├── index.html · vite.config.ts · svelte.config.js · .env.example
├── public/
│   ├── _redirects                  # Cloudflare Pages SPA fallback (see below)
│   └── favicon.svg                 # pumpkin
├── supabase/
│   ├── config.toml                 # [functions.register] verify_jwt = false
│   ├── migrations/20260915000000_init.sql
│   └── functions/register/index.ts # THE one edge function
└── src/
    ├── main.ts · App.svelte (route switch + header/footer) · app.css
    ├── lib/
    │   ├── supabase.ts             # client + typed rpc wrappers
    │   ├── router.ts               # ~30-line path router (2 routes; hand-rolled —
    │   │                           # svelte-spa-router is unmaintained for Svelte 5)
    │   ├── geocode.ts              # Photon search + reverse, debounced + cached
    │   ├── sweets.ts               # fixed categories + pt labels
    │   └── format.ts               # pt-PT date/time + EVENT_DATE (Oct 31 current year)
    ├── pages/
    │   ├── Home.svelte             # map/list toggle, register CTA
    │   └── Manage.svelte           # /gerir/{uuid}: add/edit/delete pins
    └── components/
        ├── Map.svelte              # Leaflet wrapper (display + editor modes)
        ├── PinForm.svelte          # modal add/edit form with address search
        ├── AddressSearch.svelte    # Photon autocomplete
        ├── PinCard.svelte          # list card (home) / row (manage)
        ├── RegisterModal.svelte    # name/email/Turnstile
        └── Turnstile.svelte        # own ~25-line wrapper (turnstile.render)
```

## Supabase design

### Migration `20260915000000_init.sql`

**Tables** — `users(id uuid pk default gen_random_uuid(), name, email unique, created_at)` and `pins(id uuid pk, user_id fk→users on delete cascade, name, address, lat, lng, date date, start_time time, end_time time check(end_time > start_time), sweets text[], created_at)`. Both tables RLS-enabled; `revoke all on both tables from anon, authenticated` — direct table access fully denied; everything goes through RPCs.

**RPCs** (all `SECURITY DEFINER set search_path = public`; `revoke execute from public`, `grant execute to anon`):

- `get_public_pins() returns table(...)` — SELECT pins **without `user_id`**, `where date >= date_trunc('year', now())::date` (drops past-year clutter), ordered by date, start_time. Public homepage read.
- `get_my_data(p_secret uuid) returns jsonb` — `{found:true, name, email, pins:[...]}` or `{"found": false}`. Always one row.
- `upsert_pin(p_secret, p_pin_id null default, name, address, lat, lng, date, start_time, end_time, sweets)` — verify secret exists, validate times, verify ownership when editing (raise same `invalid_secret` for "no such user" and "not your pin" — no enumeration), then INSERT … ON CONFLICT (id) DO UPDATE; capture the row id in a plpgsql variable and `RETURN to_jsonb(that row)` (no ctid hacks).
- `delete_pin(p_secret, p_pin_id) returns boolean` — verify secret, delete where id + user_id match.

### Edge Function `register` (Deno + TS)

`verify_jwt = false` (public endpoint; Turnstile is the protection). Input `{name, email, turnstileToken}`:
1. Validate (trim, 1–100 chars; lowercase email; regex) → 400 with pt-PT error.
2. `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET` + token → 403 `turnstile_failed` if not success.
3. Upsert user via service-role client (auto-injected `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`): SELECT by email; **if exists reuse the same id** (duplicate register = resend same link, idempotent, no new row); else generate uuid **server-side** (prevents uuid squatting) and INSERT.
4. Send email via plain `fetch` to `https://api.resend.com/emails` (no SDK). pt-PT copy: subject "A tua ligação para gerires os teus pins", body with `https://<SITE_URL>/gerir/<uuid>` + "Guarda esta ligação — dá-te acesso ao teu painel a qualquer momento."
5. Return `{ok:true}` in both cases (no account enumeration). CORS headers + OPTIONS preflight.

Secrets: `TURNSTILE_SECRET`, `RESEND_API_KEY`, `SITE_URL` (the three `SUPABASE_*` are auto-injected). Local: `supabase functions serve --env-file supabase/functions/.env` (gitignored).

## Data model details

- **Timespan**: `date` defaults to Oct 31 of current year (`EVENT_DATE()` in format.ts; date input allows e.g. Oct 30 parties). `start_time`/`end_time` are plain `time` — Portugal is UTC+0 on Oct 31 (DST ended), so display `"18:00 – 21:00"` via `toLocaleTimeString('pt-PT', ...)`, no TZ conversion anywhere. Homepage defaults to `EVENT_DATE` filter + small dropdown of distinct dates when others exist.
- **Sweets** (`sweets.ts`, text[] slugs): `chocolates`, `gomas`, `rebucados`, `bolachas`, `salgados` (Snacks salgados), `outros` — checkbox chips.

## Frontend

- **Routing** (`router.ts`): path-based (magic link is a path), 2 routes `/` and `/gerir/:uuid`; `$state` route + `popstate` listener + `navigate()`. Register is a modal on Home, not a route. Cloudflare Pages SPA fallback via `public/_redirects` (there is NO `200.html` mechanism on CF Pages):
  ```
  /assets/*  /assets/:splat  200
  /*         /index.html     200
  ```
- **Map.svelte**: Leaflet 1.9.4 used directly — `L.map` in `onMount`, instance in a plain (non-reactive) `let`, `map.remove()` on destroy, markers synced in a separate `$effect` watching the `pins` prop. **Never put the map in `$state`** (Svelte 5 gotcha). Tiles: CARTO Dark Matter `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`, attribution `© OpenStreetMap contributors © CARTO`; Portugal center `[39.7, -8.0]`, zoom 7. Markers: custom pumpkin SVG `L.divIcon` (~2KB). No clustering (~150 pins scale). Home popup: name, address, timeframe, sweets chips, "Como chegar" link (`google.com/maps/dir/?api=1&destination=lat,lng`). Manage mode: map click → draft marker → opens PinForm prefilled with reverse-geocoded address.
- **Geocoding**: **Photon, not client-side Nominatim** — Nominatim's policy explicitly forbids browser autocomplete (no User-Agent header possible, 1 req/s aggregate limit). Photon (`photon.komoot.io/api/?q=…&limit=6&lang=pt`, `/reverse`) is same OSM data, CORS-enabled, autocomplete-native. Debounce ~350ms, min 3 chars, `AbortController` cancel, module-level cache.
- **Home.svelte**: full-viewport map; floating header (logo, CTA "Registar a minha casa", toggle "Mapa | Lista"); list = PinCards sorted by date/start_time with name, address, timeframe, sweets chips; click card → flyTo pin; empty state "Ainda não há casas com doces na tua zona. Sê o primeiro a adicionar a tua!"; footer attribution.
- **RegisterModal.svelte**: "Nome", "Email", Turnstile widget (dark theme, `language: 'pt-PT'`, site key from `VITE_TURNSTILE_SITE_KEY`), submit "Receber a minha ligação" → `functions.invoke('register', …)` → success "Verifica o teu email — enviámos-te uma ligação mágica. Guarda-a…". Map error codes to pt strings.
- **Manage.svelte**: loading → `get_my_data(uuid)`; `found:false` → "Ligação desconhecida…" + register CTA; `found:true` → "Olá, {name}", editor map, "Adicionar pin", own-pin list with "Editar" (prefilled PinForm) / "Remover" (confirm), persistent banner "Guarda esta ligação nos favoritos — é a tua chave de acesso" + "Reenviar por email" (re-invokes register with stored email → same link, free via idempotent design).
- **PinForm.svelte** (add + edit): "Nome do pin", "Morada" + AddressSearch (select sets address+lat/lng; map-click prefill stays hand-editable), "Dia" (default Oct 31), "Hora de início"/"Hora de fim", sweets checkbox chips, "Guardar"/"Cancelar". Validate: name, address, start<end, ≥1 sweet.
- **Styling** (`app.css`): dark Halloween palette — near-black purple `#1a0f1e`, pumpkin orange `#ff7a1a`, purple `#7b2d8b`, cream text; rounded cards, chips. No framework.

## Config / env

`.env.example` (committed; only `VITE_*` — never the Turnstile secret or Resend key):
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA   # test key for local dev
```
Edge Function secrets (never committed): `TURNSTILE_SECRET`, `RESEND_API_KEY`, `SITE_URL` (e.g. `https://ralvessura.pages.dev`; `http://localhost:5173` in dev).

## Implementation order

1. Accounts (Step 0) · scaffold (Step 1) · `.env.example`, `_redirects`, favicon · commit.
2. `supabase init` → write migration → `supabase db push` (hosted; or `supabase start` for full-local).
3. Edge Function `register` → test locally with curl.
4. `lib/` modules: supabase.ts, router.ts, geocode.ts, sweets.ts, format.ts.
5. Map.svelte + Home.svelte (read-only happy path: pins, popups, list toggle).
6. RegisterModal + Turnstile (end-to-end register with test keys).
7. Manage + PinForm + AddressSearch (add → edit → delete).
8. Polish: icons, empty/error states, date filter, resend-link, pt-PT copy, mobile touch targets.
9. Deploy both sides; production pass.

## Deployment

- **Supabase**: `supabase link --project-ref <ref>` → `supabase db push`; Dashboard → Edge Functions → add the 3 secrets; `supabase functions deploy register`.
- **Cloudflare Pages**: create project from GitHub repo; build `npm run build`, output `dist` (`_redirects` in `public/` is copied automatically); set build env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` (production key) — note Vite env is baked at build time, redeploy after changes. Add the Pages domain to the Turnstile widget hostnames; verify Resend domain.

## Verification

**Local:** `npm run dev` at localhost:5173 (Turnstile test keys pass). Happy path: register with own email (Resend onboarding sender) → receive link → open `/gerir/{uuid}` → add 2 pins (one via map click, one via address search) → edit one, delete one → homepage shows remaining pin with popup/timeframe/sweets; list sorted. Security assertions (browser console / SQL editor): `anon .from('pins').select('*')` → denied; `anon .from('users').select('*')` → empty; `get_public_pins()` rows contain no `user_id`; `upsert_pin`/`delete_pin`/`get_my_data` with bogus secret → `invalid_secret` / `{"found": false}`. Register hardening: missing/invalid Turnstile token → 403; malformed email → 400; duplicate email → same link resent, no new row.

**After deploy:** register for real on the Pages domain → email arrives from verified domain → open `/gerir/{uuid}` in fresh incognito tab (proves SPA fallback) → add pin → visible on homepage from another device. Check Supabase function logs, test mobile, confirm Turnstile hostnames.

## Key risks

1. **`pins.user_id` leak** = leak of everyone's manage link. Never add a public SELECT policy on `pins`; only `get_public_pins()`.
2. **Nominatim client-side is policy-forbidden** → Photon (decision already baked in).
3. **Svelte 5 + Leaflet**: init/destroy in lifecycle, keep instance out of reactive state.
4. **Cloudflare Pages**: no `200.html` — use `_redirects`; keep `/assets/*` passthrough.
5. **Resend free tier** 100/day (launch-day rush could hit it — noted, not over-engineered); real sends need verified domain.
6. **Secret-URL model**: anyone with the link controls the pins (accepted by design; link sits in email + history).
