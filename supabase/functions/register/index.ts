// Registration validates input, creates or reuses a user, and emails the
// management link through Resend.
//
// Required secrets (supabase secrets set):
//   RESEND_API_KEY, FROM_EMAIL, SITE_URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (name.length < 1 || name.length > 100) return json({ error: 'invalid_name' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 400);

  // 1) Reuse the UUID when an email registers again to keep the link idempotent.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId = (existing?.id as string | undefined) ?? crypto.randomUUID();
  if (!existing) {
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: userId, name, email });
    if (insertError) {
      // Another request registered the same email concurrently; reuse its ID.
      const { data: raced } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (!raced) return json({ error: 'register_failed' }, 500);
      userId = raced.id as string;
    }
  }

  // 2) Email the management link.
  const siteUrl = (Deno.env.get('SITE_URL') ?? 'http://localhost:5173').replace(/\/+$/, '');
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev';
  const link = `${siteUrl}/gerir/${userId}`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY') ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Doces ou Travessuras <${fromEmail}>`,
      to: [email],
      subject: 'A tua ligação para gerires os teus pins 🎃',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#2a2a2a;line-height:1.6">
          <h2>Olá, ${escapeHtml(name)}! 🎃</h2>
          <p>Está tudo pronto para o teu registo no mapa <strong>Doces ou Travessuras</strong>.</p>
          <p>Esta é a tua ligação mágica para gerires os teus pins:</p>
          <p style="margin:1.2rem 0">
            <a href="${link}" style="background:#ff7a1a;color:#1a0d00;padding:0.7rem 1.3rem;border-radius:10px;font-weight:700;text-decoration:none">Abrir o meu painel</a>
          </p>
          <p style="word-break:break-all"><a href="${link}">${link}</a></p>
          <p><strong>Guarda esta ligação</strong> — ela dá-te acesso ao teu painel a qualquer momento. Com ela podes adicionar, editar ou remover a tua casa do mapa.</p>
          <p>Se a perderes, regista-te de novo com o mesmo email e recebes a mesma ligação.</p>
          <p>Boas travessuras! 👻</p>
        </div>`,
    }),
  });

  if (!resendRes.ok) {
    console.error('resend_error', resendRes.status, await resendRes.text());
    return json({ error: 'email_failed' }, 500);
  }

  return json({ ok: true });
});
