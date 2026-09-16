<script lang="ts">
  import { onMount } from 'svelte';
  import Map from '../components/Map.svelte';
  import PinCard from '../components/PinCard.svelte';
  import RegisterModal from '../components/RegisterModal.svelte';
  import { getPublicPins, type Pin } from '../lib/supabase';
  import { eventDate, formatDate } from '../lib/format';

  let pins = $state<Pin[]>([]);
  let loading = $state(true);
  let loadError = $state('');
  let view = $state<'map' | 'list'>('map');
  let selectedId = $state<string | null>(null);
  let focus = $state<{ lat: number; lng: number; n: number } | null>(null);
  let registerOpen = $state(false);
  let selectedDate = $state(eventDate());

  let dates = $derived([...new Set(pins.map((p) => p.date))].sort());
  let visible = $derived(pins.filter((p) => p.date === selectedDate));

  onMount(async () => {
    try {
      pins = await getPublicPins();
      if (dates.length > 0 && !dates.includes(selectedDate)) {
        selectedDate = dates[0];
      }
    } catch {
      loadError = 'Não foi possível carregar os pins. Tenta recarregar a página.';
    } finally {
      loading = false;
    }
  });

  function focusPin(pin: Pin): void {
    view = 'map';
    selectedId = pin.id;
    focus = { lat: pin.lat, lng: pin.lng, n: Date.now() };
  }
</script>

<div class="page home">
  <header>
    <div class="brand">
      <span class="logo">🎃</span>
      <div>
        <h1>Doces ou Travessuras</h1>
        <p class="tagline">Casas com doces para o Halloween em Portugal</p>
      </div>
    </div>
    <div class="actions">
      {#if dates.length > 0}
        <select class="date-select" bind:value={selectedDate} aria-label="Dia">
          {#each dates as d}
            <option value={d}>{formatDate(d)}</option>
          {/each}
        </select>
      {/if}
      <div class="toggle" role="tablist">
        <button role="tab" class:active={view === 'map'} onclick={() => (view = 'map')}>Mapa</button>
        <button role="tab" class:active={view === 'list'} onclick={() => (view = 'list')}>Lista</button>
      </div>
      <button class="cta" onclick={() => (registerOpen = true)}>Registar a minha casa</button>
    </div>
  </header>

  <main class:list-mode={view === 'list'}>
    {#if loading}
      <p class="status">A carregar pins… 🎃</p>
    {:else if loadError}
      <p class="status error">{loadError}</p>
    {:else if view === 'map'}
      <Map pins={visible} {focus} onSelect={(pin) => (selectedId = pin.id)} />
    {:else}
      <div class="list">
        {#if visible.length === 0}
          <p class="status">
            Ainda não há casas com doces neste dia. Sê o primeiro a adicionar a tua! 🍬
          </p>
        {:else}
          {#each visible as pin (pin.id)}
            <PinCard {pin} selected={pin.id === selectedId} onclick={() => focusPin(pin)} />
          {/each}
        {/if}
      </div>
    {/if}
  </main>

  <footer>
    <span>
      Dados geográficos ©
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
    </span>
    <span>Feito com 🎃 em Portugal</span>
  </footer>

  {#if registerOpen}
    <RegisterModal onClose={() => (registerOpen = false)} />
  {/if}
</div>
