<script lang="ts">
  // Campo de morada com autocomplete Photon.
  import { searchAddress, type GeocodeResult } from '../lib/geocode';

  let {
    value = '',
    onSelect = (_r: GeocodeResult) => {},
  }: { value?: string; onSelect?: (r: GeocodeResult) => void } = $props();

  let query = $state('');
  let typing = $state(false);
  let results = $state<GeocodeResult[]>([]);
  let open = $state(false);
  let searching = $state(false);
  let errorMsg = $state('');

  // Sincroniza a partir do pai (ex.: reverse geocoding) quando o utilizador não está a escrever.
  $effect(() => {
    if (!typing && value !== query) query = value;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;

  function onInput(): void {
    typing = true;
    clearTimeout(timer);
    const q = query.trim();
    if (q.length < 3) {
      results = [];
      open = false;
      return;
    }
    timer = setTimeout(async () => {
      controller?.abort();
      controller = new AbortController();
      searching = true;
      errorMsg = '';
      try {
        results = await searchAddress(q, controller.signal);
        open = results.length > 0;
      } catch {
        if (controller.signal.aborted) return;
        errorMsg = 'Não foi possível pesquisar. Tenta de novo.';
      } finally {
        searching = false;
      }
    }, 350);
  }

  function choose(r: GeocodeResult): void {
    typing = false;
    query = r.label;
    open = false;
    results = [];
    onSelect(r);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && open && results.length > 0) {
      e.preventDefault();
      choose(results[0]);
    } else if (e.key === 'Escape') {
      open = false;
    }
  }

  function onBlur(): void {
    typing = false;
    // atraso para deixar o clique na lista registar-se primeiro
    setTimeout(() => (open = false), 150);
  }
</script>

<div class="addr-search">
  <input
    type="text"
    placeholder="Ex.: Rua das Flores 12, Lisboa"
    bind:value={query}
    oninput={onInput}
    onkeydown={onKeydown}
    onfocus={() => results.length > 0 && (open = true)}
    onblur={onBlur}
    aria-label="Morada"
  />
  {#if searching}<p class="hint">A pesquisar…</p>{/if}
  {#if open}
    <ul class="results">
      {#each results as r}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li
          role="option"
          aria-selected={false}
          onmousedown={(e) => {
            e.preventDefault();
            choose(r);
          }}
        >
          {r.label}
        </li>
      {/each}
    </ul>
  {/if}
  {#if errorMsg}<p class="error">{errorMsg}</p>{/if}
</div>
