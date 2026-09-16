<script lang="ts">
  // Address field backed by OpenRouteService autocomplete.
  import { onDestroy } from 'svelte';
  import { searchAddress, type GeocodeResult } from '../lib/geocode';

  let {
    value = '',
    locating = false,
    onSelect = (_r: GeocodeResult) => {},
    onLocate = () => {},
  }: {
    value?: string;
    locating?: boolean;
    onSelect?: (r: GeocodeResult) => void;
    onLocate?: () => void;
  } = $props();

  let query = $state('');
  let typing = $state(false);
  let results = $state<GeocodeResult[]>([]);
  let open = $state(false);
  let searching = $state(false);
  let errorMsg = $state('');

  // Synchronize parent updates, such as reverse geocoding, while the user is not typing.
  $effect(() => {
    if (!typing && value !== query) query = value;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;

  function onInput(): void {
    typing = true;
    clearTimeout(timer);
    controller?.abort();
    const q = query.trim();
    if (q.length < 3) {
      searching = false;
      results = [];
      open = false;
      return;
    }
    timer = setTimeout(async () => {
      const requestController = new AbortController();
      controller = requestController;
      searching = true;
      errorMsg = '';
      try {
        results = await searchAddress(q, requestController.signal);
        open = results.length > 0;
      } catch {
        if (requestController.signal.aborted) return;
        errorMsg = 'Não foi possível pesquisar. Tenta de novo.';
      } finally {
        if (controller === requestController) searching = false;
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
    // Delay closing so a list click can be registered first.
    setTimeout(() => (open = false), 150);
  }

  function locate(): void {
    typing = false;
    open = false;
    results = [];
    onLocate();
  }

  onDestroy(() => {
    clearTimeout(timer);
    controller?.abort();
  });
</script>

<div class="addr-search">
  <div class="address-input-row">
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
    <button
      class="locate"
      type="button"
      onclick={locate}
      disabled={locating}
      aria-label={locating ? 'A obter a tua localização' : 'Usar a minha localização'}
      title="Usar a minha localização"
    >
      {locating ? '…' : '⌖'}
    </button>
  </div>
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
