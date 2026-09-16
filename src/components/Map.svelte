<script lang="ts">
  // Leaflet wrapper. Never put the map instance in $state (Svelte 5): create it
  // in onMount, remove it in onDestroy, and synchronize markers in an $effect
  // that also depends on `ready`.
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import type { Pin } from '../lib/supabase';
  import { eventDate, formatDate, formatTime } from '../lib/format';
  import { sweetEmoji, sweetLabel } from '../lib/sweets';

  // 38°45'01.3"N 9°08'50.8"W
  const DEFAULT_CENTER = { lat: 38.7503611111, lng: -9.1474444444 };

  type MapCenter = { lat: number; lng: number };

  let {
    pins = [],
    mode = 'view',
    focus = null,
    initialCenter = DEFAULT_CENTER,
    center = null,
    zoom = 7,
    onSelect = (_pin: Pin) => {},
    onMapClick = (_ll: { lat: number; lng: number }) => {},
  }: {
    pins?: Pin[];
    mode?: 'view' | 'edit';
    focus?: { lat: number; lng: number; n: number } | null;
    initialCenter?: MapCenter;
    center?: MapCenter | null;
    zoom?: number;
    onSelect?: (pin: Pin) => void;
    onMapClick?: (ll: { lat: number; lng: number }) => void;
  } = $props();

  let mapEl = $state<HTMLDivElement>();
  let ready = $state(false);
  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;

  const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

  // Render the pumpkin SVG as a divIcon without an icon plugin.
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
      center: [initialCenter.lat, initialCenter.lng],
      zoom,
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

  // Synchronize markers whenever `pins` changes or the map becomes ready.
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

  // Recenter when a parent supplies a new location, such as the browser location.
  $effect(() => {
    if (!ready || !map || !center) return;
    const target = L.latLng(center.lat, center.lng);
    if (!map.getCenter().equals(target)) {
      map.flyTo(target, map.getZoom(), { duration: 0.8 });
    }
  });

  // Fly to a pin when the user selects its list card.
  $effect(() => {
    if (ready && map && focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  });
</script>

<div class="map" bind:this={mapEl}></div>
