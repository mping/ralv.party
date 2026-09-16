# Ralvessura

A community **trick-or-treat map** for Portugal, inspired by the [Trick or Treat Map](https://www.trickortreatmap.com/map). The interface is written in Portuguese (`pt-PT`). Visitors can browse participating homes on a map or as a list. Each participant receives a private, persistent link for adding, editing, and removing their pins.

## Architecture

- React, TypeScript, and Vite, deployed as a static SPA.
- Leaflet with OpenStreetMap tiles and Photon/Komoot geocoding.
- Supabase Postgres with RLS and RPCs for public reads and pin management.
- A Supabase Edge Function creates registrations and sends management links through Resend.
- Cloudflare Pages is the recommended frontend host.

## Prerequisites

- Node.js `20.19+` or `22.12+` and npm.
- Docker, only when running Supabase locally.
- Free [Supabase](https://supabase.com/dashboard) and [Resend](https://resend.com/) accounts.
- A Cloudflare account only when deploying to Cloudflare Pages.

## Create the required credentials

### 1. Supabase

1. Create a project in the [Supabase Dashboard](https://supabase.com/dashboard/new), preferably in a European region.
2. Open **Connect** or **Project Settings → API Keys**, then copy:
   - the **Project URL** into `SUPABASE_URL`;
   - the **Publishable key** (`sb_publishable_...`) into `SUPABASE_ANON_KEY`. The environment variable retains its legacy `ANON_KEY` name but accepts the current publishable key.
3. Save the `project-ref` shown in `https://supabase.com/dashboard/project/<project-ref>`.

The URL and publishable key are bundled into the browser application, where access is restricted by RLS. The Vite configuration exposes only these two exact names; never add a secret or service-role key to its `define` block. See the [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

`npx supabase login` opens a browser-based login. For non-interactive CI, create a token under **Supabase Account → Access Tokens** and expose it as `SUPABASE_ACCESS_TOKEN`. A CLI access token is not required for normal local development.

### 2. Resend

1. For production email, add and verify a domain in [Resend Domains](https://resend.com/domains). Resend will display the DNS records that must be created.
2. Open [Resend API Keys](https://resend.com/api-keys) and create a sending key. Restrict it to the verified domain when possible.
3. Copy the key when it is created and store it as `RESEND_API_KEY`; its full value is not shown again.
4. Set `FROM_EMAIL` to an address on the verified domain, such as `map@updates.example.com`.

For testing, `onboarding@resend.dev` can send only to the email address associated with your Resend account. Sending to other users requires a verified domain. See the Resend documentation for [API keys](https://resend.com/docs/dashboard/api-keys/introduction) and [verified domains](https://resend.com/docs/dashboard/domains/introduction).

## Run with hosted Supabase

Install dependencies and create the frontend environment file:

```bash
npm ci
cp .env.example .env
```

Populate `.env` with the Supabase values:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=sb_publishable_...
```

Link the CLI to the hosted project and apply the existing migration:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

In the Supabase Dashboard, open **Edge Functions → Secrets** and add:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | API key created in Resend |
| `FROM_EMAIL` | Sender authorized by Resend |
| `SITE_URL` | `http://localhost:5173` during local development, or the public URL |

The Edge Function runtime receives its own `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically from Supabase. The root frontend `.env` also contains the public URL, but it must never contain `SUPABASE_SERVICE_ROLE_KEY`.

Deploy the registration function:

```bash
npx supabase functions deploy register
```

Start the frontend:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Run Supabase locally

With Docker running, start the local stack and inspect its credentials:

```bash
npx supabase start
npx supabase status
```

Copy the displayed API URL and publishable/anon key into `.env`. Create `supabase/functions/.env`, which is ignored by Git:

```dotenv
RESEND_API_KEY=re_...
FROM_EMAIL=onboarding@resend.dev
SITE_URL=http://localhost:5173
```

Run the function and frontend in separate terminals:

```bash
npx supabase functions serve register --env-file supabase/functions/.env
```

```bash
npm run dev
```

## Checks and production build

```bash
npm run check    # Run TypeScript checks
npm run build    # Build the production bundle in dist/
npm run preview  # Preview the production bundle locally
```

Manually test the complete flow: register an email, open `/gerir/{uuid}`, create, edit, and remove a pin, then confirm the result on the public map.

## Deploy to Cloudflare Pages

In the Cloudflare Dashboard, open **Workers & Pages → Create → Pages** and connect the repository. Use `npm run build` as the build command and `dist` as the output directory. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to the Pages project settings. Dashboard-based Git deployment does not require a Cloudflare API token.

After the first deployment:

1. Update the Edge Function's `SITE_URL` secret to the public Pages URL.
2. Test the emailed management link in a private browser window.

## Security model

The UUID in `/gerir/{uuid}` is the participant's persistent credential: anyone with the link can control that participant's pins. Never expose `users.id` or `pins.user_id` in public responses, logs, or analytics. Never commit `.env`, `supabase/functions/.env`, or secret keys.

The `register` Edge Function is intentionally public and currently has no CAPTCHA or application-level rate limit. Monitor Supabase and Resend usage, and add abuse protection before promoting the service to a large public audience.
