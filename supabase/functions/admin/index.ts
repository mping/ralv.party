// Admin moderation: lists every participant and pin, edits or deletes pins, and
// deletes participants. Every request must carry the fixed admin password in the
// x-admin-password header; it is never accepted in the URL.
//
// Required secrets (supabase secrets set):
//   ADMIN_PASSWORD (at least 32 characters; generate with `openssl rand -hex 32`), SITE_URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Responses never include users.id or pins.user_id: participants are identified
// by email, because the user ID is their management credential.

import { createClient } from 'npm:@supabase/supabase-js@2';

const MIN_PASSWORD_LENGTH = 32;

const siteUrl = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');

const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PIN_COLUMNS =
  'id, name, address, floor_door, notes, lat, lng, date, start_time, end_time, sweets, created_at';

const sha256 = async (s: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

// Hashing first gives equal-length inputs, so the loop runs in constant time
// regardless of where (or whether) the candidate differs.
async function passwordMatches(candidate: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(candidate), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const asText = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // 1) Fail closed when the password is missing or too short to be safe.
  const expected = (Deno.env.get('ADMIN_PASSWORD') ?? '').trim();
  if (expected.length < MIN_PASSWORD_LENGTH) return json({ error: 'admin_disabled' }, 503);

  const candidate = req.headers.get('x-admin-password') ?? '';
  if (!(await passwordMatches(candidate, expected))) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // 2) Dispatch the moderation action.
  switch (body.action) {
    case 'list': {
      const { data, error } = await supabase
        .from('users')
        .select(`name, email, created_at, pins(${PIN_COLUMNS})`)
        .order('created_at', { ascending: false })
        .order('date', { referencedTable: 'pins' })
        .order('start_time', { referencedTable: 'pins' });
      if (error) {
        console.error('admin_list_error', error);
        return json({ error: 'admin_failed' }, 500);
      }
      return json({ users: data });
    }

    case 'update_pin': {
      const pin = (typeof body.pin === 'object' && body.pin !== null ? body.pin : {}) as Record<
        string,
        unknown
      >;
      const pinId = asText(pin.id);
      if (!pinId || !UUID_RE.test(pinId)) return json({ error: 'invalid_pin' }, 400);

      // Table check constraints validate lengths, coordinates, and end_time > start_time.
      const { data, error } = await supabase
        .from('pins')
        .update({
          name: asText(pin.name),
          address: asText(pin.address),
          floor_door: asText(pin.floor_door) || null,
          notes: asText(pin.notes) || null,
          lat: pin.lat,
          lng: pin.lng,
          date: pin.date,
          start_time: pin.start_time,
          end_time: pin.end_time,
          sweets: pin.sweets,
        })
        .eq('id', pinId)
        .select('id');
      if (error) {
        // Classes 22 (data exception) and 23 (constraint violation) are bad input.
        if (/^2[23]/.test(error.code ?? '')) return json({ error: 'invalid_pin' }, 400);
        console.error('admin_update_pin_error', error);
        return json({ error: 'admin_failed' }, 500);
      }
      if (!data?.length) return json({ error: 'not_found' }, 404);
      return json({ ok: true });
    }

    case 'delete_pin': {
      const pinId = asText(body.pin_id);
      if (!pinId || !UUID_RE.test(pinId)) return json({ error: 'not_found' }, 404);

      const { data, error } = await supabase.from('pins').delete().eq('id', pinId).select('id');
      if (error) {
        console.error('admin_delete_pin_error', error);
        return json({ error: 'admin_failed' }, 500);
      }
      if (!data?.length) return json({ error: 'not_found' }, 404);
      return json({ ok: true });
    }

    case 'delete_user': {
      const email = asText(body.email)?.toLowerCase();
      if (!email) return json({ error: 'not_found' }, 404);

      // pins.user_id cascades, so this also removes the participant's pins.
      const { data, error } = await supabase
        .from('users')
        .delete()
        .eq('email', email)
        .select('email');
      if (error) {
        console.error('admin_delete_user_error', error);
        return json({ error: 'admin_failed' }, 500);
      }
      if (!data?.length) return json({ error: 'not_found' }, 404);
      return json({ ok: true });
    }

    default:
      return json({ error: 'invalid_action' }, 400);
  }
});
