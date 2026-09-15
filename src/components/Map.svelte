<script lang="ts">
  // Wrapper do Leaflet. A instância do mapa NUNCA entra em $state (Svelte 5):
  // criamos no onMount, removemos no onDestroy, e sincronizamos os markers num $effect
  // que também depende de `ready`.
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { Pin } from '../lib/supabase';
  import { eventDate, formatDate, formatTime } from '../lib/format';
  import { sweetEmoji, sweetLabel } from '../lib/sweets';

  let {
    pins = [],
    mode = 'view',
    focus = null,
    onSelect = (_pin: Pin) => {},
    onMapClick = (_ll: { lat: number; lng: number }) => {},
  }: {
    pins?: Pin[];
    mode?: 'view' | 'edit';
    focus?: { lat: number; lng: number; n: number } | null;
    onSelect?: (pin: Pin) => void;
    onMapClick?: (ll: { lat: number; lng: number }) => void;
  } = $props();

  let mapEl = $state<HTMLDivElement>();
  let ready = $state(false);
  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;

  const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  // Abóbora SVG como divIcon (sem plugin de ícones).
  const pumpkinIcon = L.divIcon({
    className: 'pumpkin-marker',
    html: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="18" rx="12" ry="10" fill="#ff7a1a"/>
      <ellipse cx="10" cy="18" rx="4.5" ry="9.5" fill="#ff8c3a"/>
      <path d="M16 9c1-3 4-5 4-5s-1 3 0 5" stroke="#5c3a10" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <path d="M10 20.5l2.5-1.5 2 2.5 2-2.5 2.5 1.5" stroke="#1a0f1e" stroke-width="1.8" fill="none" stroke-linejoin="round"/>
      <circle cx="12" cy="15.5" r="1.4" fill="#1a0f1e"/>
      <circle cx="20" cy="15.5" r="1.4" fill="#1a0f1e"/>
    </svg>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });

  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function popupHtml(pin: Pin): string {
    const chips = pin.sweets
      .map((s) => `<span class="chip">${esc(sweetEmoji(s))} ${esc(sweetLabel(s))}</span>`)
      .join(' ');
    const dateLine =
      pin.date === eventDate() ? '' : `<p class="p-date">${esc(formatDate(pin.date))}</p>`;
    return `
      <div class="pin-popup">
        <h3>${esc(pin.name)}</h3>
        ${dateLine}
        <p class="p-addr">📍 ${esc(pin.address)}</p>
        <p class="p-time">⏰ ${esc(formatTime(pin.start_time))} – ${esc(formatTime(pin.end_time))}</p>
        <div class="chips">${chips}</div>
        <a class="p-dir" href="https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}" target="_blank" rel="noreferrer">Como chegar</a>
      </div>`;
  }

  onMount(() => {
    if (!mapEl) return;
    map = L.map(mapEl, {
      center: [39.7, -8.0],
      zoom: 7,
      minZoom: 6,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    if (mode === 'edit') {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }
    ready = true;
  });

  onDestroy(() => {
    map?.remove();
    map = null;
    markersLayer = null;
  });

  // Sincroniza os markers sempre que `pins` mudar (ou o mapa ficar pronto).
  $effect(() => {
    const layer = markersLayer;
    if (!ready || !layer) return;
    layer.clearLayers();
    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng], { icon: pumpkinIcon });
      marker.bindPopup(popupHtml(pin));
      marker.on('click', () => onSelect(pin));
      marker.addTo(layer);
    }
  });

  // Fly-to quando o utilizador clica num card da lista.
  $effect(() => {
    if (ready && map && focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  });
</script>

<div class="map" bind:this={mapEl}></div>
