<script lang="ts">
  import { onMount } from 'svelte';
  import type { Pin, PinInput } from '../lib/supabase';
  import { mapError } from '../lib/supabase';
  import { reverseGeocode } from '../lib/geocode';
  import { eventDate } from '../lib/format';
  import { SWEETS } from '../lib/sweets';
  import AddressSearch from './AddressSearch.svelte';

  let {
    initial = null,
    onSave = (_pin: PinInput) => Promise.resolve(),
    onClose = () => {},
  }: {
    initial?: Pin | { lat: number; lng: number } | null;
    onSave?: (pin: PinInput) => Promise<void>;
    onClose?: () => void;
  } = $props();

  function isEdit(): boolean {
    return initial !== null && 'id' in initial;
  }

  let name = $state('');
  let address = $state('');
  let lat = $state<number | null>(null);
  let lng = $state<number | null>(null);
  let date = $state(eventDate());
  let start = $state('18:00');
  let end = $state('21:00');
  let sweets = $state<string[]>(['chocolate']);
  let errorMsg = $state('');
  let saving = $state(false);
  let locating = $state(false);

  // The modal mounts only when opened, so hydrating its fields here is safe.
  // Reading the prop inside closures also avoids capturing only its initial value.
  onMount(async () => {
    if (isEdit()) {
      const pin = initial as Pin;
      name = pin.name;
      address = pin.address;
      date = pin.date;
      start = pin.start_time.slice(0, 5);
      end = pin.end_time.slice(0, 5);
      sweets = pin.sweets;
    }
    if (initial?.lat != null && initial.lng != null) {
      lat = initial.lat;
      lng = initial.lng;
    }
    // Reverse geocode pins created by clicking on the map.
    if (lat !== null && lng !== null && !address) {
      try {
        const found = await reverseGeocode(lat, lng);
        if (found) address = found;
      } catch {
        // Leave the address empty so the user can enter it manually.
      }
    }
  });

  function toggleSweet(slug: string): void {
    sweets = sweets.includes(slug) ? sweets.filter((s) => s !== slug) : [...sweets, slug];
  }

  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      });
    });
  }

  async function locateAddress(): Promise<void> {
    errorMsg = '';
    if (!('geolocation' in navigator)) {
      errorMsg = 'A localização não é suportada neste navegador.';
      return;
    }

    locating = true;
    try {
      const position = await getCurrentPosition();
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      address = '';
      const found = await reverseGeocode(lat, lng);
      if (!found) {
        errorMsg = 'Não foi possível encontrar a morada desta localização.';
        return;
      }
      address = found;
    } catch {
      errorMsg = 'Não foi possível usar a tua localização. Confirma a permissão e tenta de novo.';
    } finally {
      locating = false;
    }
  }

  function fail(msg: string): false {
    errorMsg = msg;
    return false;
  }

  function validate(): boolean {
    if (!name.trim()) return fail('Dá um nome ao pin.');
    if (!address.trim()) return fail('Indica a morada (usa a pesquisa).');
    if (lat === null || lng === null)
      return fail('Escolhe a localização: procura a morada na pesquisa.');
    if (!start || !end) return fail('Indica a hora de início e de fim.');
    if (start >= end) return fail('A hora de fim tem de ser depois da hora de início.');
    if (sweets.length === 0) return fail('Escolhe pelo menos um tipo de doces.');
    return true;
  }

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    errorMsg = '';
    if (!validate()) return;
    saving = true;
    try {
      await onSave({
        id: isEdit() ? (initial as Pin).id : null,
        name: name.trim(),
        address: address.trim(),
        lat: lat as number,
        lng: lng as number,
        date,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        sweets,
      });
      // On success, the parent closes the modal and unmounts this component.
    } catch (err) {
      errorMsg = mapError(err);
      saving = false;
    }
  }
</script>

<div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Pin">
  <div class="modal">
    <button class="close" onclick={onClose} aria-label="Fechar">✕</button>
    <h2>{isEdit() ? 'Editar pin' : 'Adicionar pin'}</h2>

    <form onsubmit={submit}>
      <label>
        Nome do pin
        <input type="text" bind:value={name} maxlength="120" placeholder="Ex.: Casa do Tiago" />
      </label>

      <label>
        Morada
        <AddressSearch
          value={address}
          {locating}
          onSelect={(r) => {
            address = r.label;
            lat = r.lat;
            lng = r.lng;
          }}
          onLocate={() => void locateAddress()}
        />
      </label>
      {#if lat !== null && lng !== null}
        <p class="hint">📍 {lat.toFixed(5)}, {lng.toFixed(5)}</p>
      {:else}
        <p class="hint">Ainda sem localização — usa a pesquisa acima.</p>
      {/if}

      <div class="row">
        <label>
          Dia
          <input type="date" bind:value={date} />
        </label>
      </div>
      <div class="row">
        <label>
          Hora de início
          <input type="time" bind:value={start} />
        </label>
        <label>
          Hora de fim
          <input type="time" bind:value={end} />
        </label>
      </div>

      <fieldset class="sweets">
        <legend>Doces disponíveis</legend>
        <div class="sweet-grid">
          {#each SWEETS as sweet}
            <label class="sweet-option" class:checked={sweets.includes(sweet.slug)}>
              <input
                type="checkbox"
                checked={sweets.includes(sweet.slug)}
                onchange={() => toggleSweet(sweet.slug)}
              />
              <span>{sweet.emoji} {sweet.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      {#if errorMsg}<p class="error" role="alert">{errorMsg}</p>{/if}

      <div class="actions">
        <button type="button" class="ghost" onclick={onClose}>Cancelar</button>
        <button class="cta" type="submit" disabled={saving}>
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </form>
  </div>
</div>
