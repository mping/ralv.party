<script lang="ts">
  // Wrapper mínimo do widget Turnstile da Cloudflare (tipos globais em src/global.d.ts).
  import { onMount, onDestroy } from 'svelte';

  let {
    siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string,
    onToken = (_token: string) => {},
  }: { siteKey?: string; onToken?: (token: string) => void } = $props();

  let el = $state<HTMLDivElement>();
  let widgetId: string | null = null;

  function render(): void {
    if (!el || widgetId || !window.turnstile) return;
    widgetId = window.turnstile.render(el, {
      sitekey: siteKey,
      theme: 'dark',
      language: 'pt-PT',
      callback: (token: string) => onToken(token),
    });
  }

  onMount(() => {
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
  });

  onDestroy(() => {
    if (widgetId) window.turnstile?.remove(widgetId);
  });
</script>

<div class="turnstile" bind:this={el}></div>
