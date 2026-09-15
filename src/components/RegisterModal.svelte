<script lang="ts">
  import { sendMagicLink, mapError } from '../lib/supabase';
  import Turnstile from './Turnstile.svelte';

  let { onClose = () => {} }: { onClose?: () => void } = $props();

  let name = $state('');
  let email = $state('');
  let turnstileToken = $state<string | null>(null);
  let turnstileReset = $state(0);
  let status = $state<'idle' | 'sending' | 'success' | 'error'>('idle');
  let errorMsg = $state('');

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    errorMsg = '';
    if (!name.trim() || !email.trim()) {
      errorMsg = 'Preenche o nome e o email.';
      status = 'error';
      return;
    }
    if (!turnstileToken) {
      errorMsg = 'Confirma que não és um robô.';
      status = 'error';
      return;
    }
    status = 'sending';
    try {
      await sendMagicLink(name.trim(), email.trim(), turnstileToken);
      status = 'success';
    } catch (err) {
      // O token Turnstile é de utilização única: recria o widget para a próxima tentativa.
      turnstileToken = null;
      turnstileReset += 1;
      errorMsg = mapError(err);
      status = 'error';
    }
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Registar">
  <div class="modal">
    <button class="close" onclick={onClose} aria-label="Fechar">✕</button>

    {#if status === 'success'}
      <h2>Verifica o teu email 🎃</h2>
      <p>
        Enviámos-te uma <strong>ligação mágica</strong>. Guarda-a — dá-te acesso aos teus
        pins a qualquer momento.
      </p>
      <p class="hint">
        Não recebeste nada? Vê a pasta de spam ou tenta de novo com o mesmo email —
        recebes a mesma ligação.
      </p>
      <button class="cta" onclick={onClose}>Fechar</button>
    {:else}
      <h2>Registar a minha casa</h2>
      <p class="hint">
        Vais receber um email com uma ligação privada para gerires os teus pins.
      </p>
      <form onsubmit={submit}>
        <label>
          Nome
          <input type="text" bind:value={name} maxlength="100" placeholder="O teu nome" required />
        </label>
        <label>
          Email
          <input type="email" bind:value={email} placeholder="nome@exemplo.pt" required />
        </label>
        {#key turnstileReset}
          <Turnstile onToken={(t) => (turnstileToken = t)} />
        {/key}
        {#if errorMsg}<p class="error" role="alert">{errorMsg}</p>{/if}
        <button class="cta" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'A enviar…' : 'Receber a minha ligação'}
        </button>
      </form>
    {/if}
  </div>
</div>
