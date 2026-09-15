<script lang="ts">
  import { onMount } from 'svelte';
  import Map from '../components/Map.svelte';
  import PinCard from '../components/PinCard.svelte';
  import PinForm from '../components/PinForm.svelte';
  import {
    getMyData,
    upsertPin,
    deletePin,
    mapError,
    type Pin,
    type PinInput,
  } from '../lib/supabase';
  import { router } from '../lib/router.svelte';

  let uuid = $derived(router.route.name === 'manage' ? router.route.uuid : '');

  let loading = $state(true);
  let found = $state(false);
  let userName = $state('');
  let pins = $state<Pin[]>([]);
  let loadError = $state('');
  let formOpen = $state(false);
  let editing = $state<Pin | { lat: number; lng: number } | null>(null);
  let focus = $state<{ lat: number; lng: number; n: number } | null>(null);

  async function fetchData(): Promise<void> {
    const data = await getMyData(uuid);
    found = data.found;
    if (data.found) {
      userName = data.name ?? '';
      pins = data.pins ?? [];
    }
  }

  onMount(async () => {
    try {
      await fetchData();
    } catch (err) {
      loadError = mapError(err);
    } finally {
      loading = false;
    }
  });

  function openForm(target: Pin | { lat: number; lng: number } | null): void {
    editing = target;
    formOpen = true;
  }

  async function save(pin: PinInput): Promise<void> {
    await upsertPin(uuid, pin);
    await fetchData(); // atualiza a lista (erros propagam para o PinForm)
    formOpen = false;
    editing = null;
  }

  async function remove(pin: Pin): Promise<void> {
    if (!window.confirm(`Remover "${pin.name}"?`)) return;
    try {
      await deletePin(uuid, pin.id);
      pins = pins.filter((p) => p.id !== pin.id);
    } catch (err) {
      window.alert(mapError(err));
    }
  }
</script>

<div class="page manage">
  <header>
    <div class="brand">
      <span class="logo">🎃</span>
      <div>
        <h1>Doces ou Travessuras</h1>
        <p class="tagline">A gerir os teus pins</p>
      </div>
    </div>
    <div class="actions">
      {#if found}
        <button class="cta" onclick={() => openForm(null)}>Adicionar pin</button>
      {/if}
    </div>
  </header>

  {#if loading}
    <main><p class="status">A carregar… 🎃</p></main>
  {:else if loadError}
    <main><p class="status error">{loadError}</p></main>
  {:else if !found}
    <main class="unknown">
      <div class="unknown-card">
        <h2>Ligação desconhecida 👻</h2>
        <p>
          Não reconhecemos esta ligação. Verifica o email que recebeste ou regista-te
          de novo com o mesmo email para receberes a tua ligação.
        </p>
        <a class="cta" href="/">Voltar ao mapa</a>
      </div>
    </main>
  {:else}
    <main class="manage-grid">
      <div class="map-col">
        <Map pins={pins} mode="edit" {focus} onMapClick={(ll) => openForm(ll)} />
      </div>
      <aside class="my-pins">
        <h2>Olá, {userName}! 👋</h2>
        <p class="hint">
          <strong>Guarda esta ligação nos favoritos</strong> — é a tua chave de acesso.
          Se a perderes, regista-te de novo com o mesmo email e recebes a mesma ligação.
        </p>
        <p class="hint map-tip">
          Clica no mapa para escolher o local de um novo pin, ou usa o botão acima e
          pesquisa a morada no formulário.
        </p>

        {#if pins.length === 0}
          <p class="status">Ainda não tens pins. Adiciona o primeiro! 🍬</p>
        {:else}
          <div class="own-list">
            {#each pins as pin (pin.id)}
              <div class="own-pin">
                <PinCard
                  {pin}
                  onclick={() => (focus = { lat: pin.lat, lng: pin.lng, n: Date.now() })}
                />
                <div class="own-actions">
                  <button class="ghost" onclick={() => openForm(pin)}>Editar</button>
                  <button class="danger" onclick={() => remove(pin)}>Remover</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </aside>
    </main>
  {/if}

  <footer>
    <span>Feito com 🎃 em Portugal</span>
  </footer>

  {#if formOpen}
    <PinForm
      initial={editing}
      onSave={save}
      onClose={() => {
        formOpen = false;
        editing = null;
      }}
    />
  {/if}
</div>
