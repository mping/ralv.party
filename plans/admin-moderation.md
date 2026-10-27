# Password-protected admin moderation (`admin` Edge Function + `/admin` page)

## Context

The organiser needs a way to moderate the map: see every participant and pin, edit or delete any pin, and delete a participant. That requires a backend endpoint with service-role access, gated by one fixed, long password (no user accounts). The caller is a new `/admin` page in the existing SPA.

Today the only backend is `supabase/functions/register` (public, `verify_jwt = false`). All browser data access goes through anon RPCs. The `users.id` UUID is each participant's management credential, so the admin API must not return it either.

**Approach:** add a second Edge Function, `admin`. It checks a header `x-admin-password` against the Supabase secret `ADMIN_PASSWORD`, using a constant-time comparison, and only then performs the moderation action with the service-role client. The SPA gets an `/admin` route with a password form that reuses `PinCard` and `PinForm`.

Why this design:
- **Header, not URL.** The password never appears in a query string, so it stays out of history, logs and `Referer`.
- **Strength comes from length.** A secret of 64 or more random characters (`openssl rand -hex 32`, 256 bits) cannot be brute-forced, so rate limiting is not needed.
- **Fail closed.** If the secret is missing or shorter than 32 characters, every request is refused.

## Steps

0. Save this plan as `plans/admin-moderation.md`, following the repo convention.

1. **`supabase/functions/admin/index.ts`** (new). Mirror the structure and helpers of `register/index.ts`: the `corsHeaders`/`json` helpers, `Deno.serve`, and the `npm:@supabase/supabase-js@2` service-role client.
   - CORS: `Access-Control-Allow-Origin` is `SITE_URL` rather than `*`, as defence in depth. `Allow-Headers` adds `x-admin-password`.
   - `passwordMatches(candidate, expected)`: SHA-256 both values with `crypto.subtle.digest`, then XOR-accumulate the bytes. This makes the comparison constant-time and independent of length.
   - Order of checks:
     - `OPTIONS` returns the CORS response.
     - Any method other than POST returns 405.
     - If `ADMIN_PASSWORD` is missing or shorter than 32 characters, return 503 `admin_disabled`.
     - If the header does not match, return 401 `unauthorized`. This check runs before the body is parsed.
     - Then dispatch on `body.action`.
   - Actions:
     - `list`: `users.select('name, email, created_at, pins(id, name, address, floor_door, notes, lat, lng, date, start_time, end_time, sweets, created_at)')`, ordered by `created_at`. It includes past years and never selects `users.id` or `pins.user_id`.
     - `update_pin { pin: PinInput }`: `pins.update(...).eq('id', pin.id).select('id')`. Empty `floor_door`/`notes` become `null`, matching `nullif` in `upsert_pin`. No row returns 404 `not_found`. A check-constraint violation returns 400 `invalid_pin`. The table's check constraints already validate lengths, coordinates and `end_time > start_time`.
     - `delete_pin { pin_id }`: delete by id. No row returns 404 `not_found`.
     - `delete_user { email }`: delete from `users` by email, which is unique. The `on delete cascade` foreign key removes that user's pins.
     - Any other action returns 400 `invalid_action`.
   - The header comment documents the required secrets: `ADMIN_PASSWORD` and `SITE_URL`.

2. **`supabase/config.toml`**: add `[functions.admin]` with `verify_jwt = false` and a comment saying access is gated by `ADMIN_PASSWORD` inside the function. This matches `register`; publishable keys are not JWTs.

3. **`src/lib/supabase.ts`**:
   - Add an `AdminUser { name; email; created_at; pins: Pin[] }` type.
   - Add a private `invokeAdmin<T>(password, body)` helper. It calls `supabase.functions.invoke('admin', { body, headers: { 'x-admin-password': password } })`. On a `FunctionsHttpError` it reads the code with `await error.context.json()`, because `context` is the `Response`, and throws `new Error(code)`.
   - Export `adminList`, `adminUpdatePin`, `adminDeletePin` and `adminDeleteUser`.
   - Extend `mapError` with pt-PT messages for `unauthorized` ("Palavra-passe inválida."), `admin_disabled`, `not_found` and `invalid_pin`.

4. **`src/lib/router.ts` / `src/App.tsx`**: add the route `{ name: 'admin' }` for `/^\/admin\/?$/` and render `<Admin />`. `public/_redirects` already falls back to `index.html`, so it needs no change.

5. **`src/pages/Admin.tsx`** (new), modelled on `Manage.tsx`:
   - **Logged out:** a card with `<input type="password" autoComplete="current-password">`, so password managers can store the password. Submitting calls `adminList`. On success, the password is kept in `sessionStorage` (wrapped in try/catch) so a reload does not ask again. Closing the tab forgets it.
   - **Logged in:** a header with a "Sair" button that clears storage and state.
   - One section per participant shows name, email and registration date, with a "Remover participante" button behind `window.confirm`.
   - Each pin is shown with `PinCard`, plus "Editar" and "Remover" buttons, reusing the `own-pin`/`own-actions` markup from `Manage.tsx`.
   - "Editar" opens `<PinForm initial={pin} onSave={…adminUpdatePin…} />`. After any mutation the page reloads the data. A 401 at any point drops back to the login card.
   - All copy is pt-PT.

6. **`src/app.css`**: add minimal styles for the per-participant grouping and the login card, reusing the existing button and card classes.

7. **Docs.**
   - `README.md`: add `ADMIN_PASSWORD` to the Edge Function secrets table, including the generation command `openssl rand -hex 32`. Add `npx supabase functions deploy admin`. Add a security-model paragraph: the password grants full moderation, so rotate it with `supabase secrets set` if it leaks.
   - `AGENTS.md`: mention the `admin` function and add `/admin` to the manual-verification list.
   - Locally, add `ADMIN_PASSWORD` to the git-ignored `supabase/functions/.env`.

## Setup commands (for the user)

```bash
openssl rand -hex 32                      # generate the password; store it in a password manager
npx supabase secrets set ADMIN_PASSWORD=<value>
npx supabase functions deploy admin
```

## Verification

1. Run `npm run check` and `npm run build`.
2. Start the local stack: `npx supabase start`, `npx supabase functions serve --env-file supabase/functions/.env`, `npm run dev`.
3. Test the gate with curl against `http://127.0.0.1:54321/functions/v1/admin`:
   - No header returns 401.
   - A wrong password returns 401.
   - The correct password with `{"action":"list"}` returns 200, and the JSON contains no user `id` or `user_id`.
   - With `ADMIN_PASSWORD` removed from the env file, the function returns 503.
4. Check the page in a browser at `/admin`:
   - A wrong password shows an error.
   - The correct password lists participants.
   - Editing a pin shows the change on the public map.
   - Deleting a pin removes it.
   - Deleting a participant removes all their pins.
   - A reload keeps the session, "Sair" logs out, and a new tab asks for the password again.
5. Regression: the public map and list, registration, and `/gerir/{uuid}` create, edit and delete all still work.
