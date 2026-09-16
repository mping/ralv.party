import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Pin } from '../lib/supabase';
import { eventDate, formatDate, formatTime } from '../lib/format';
import { sweetEmoji, sweetLabel } from '../lib/sweets';

// 38°45'01.3"N 9°08'50.8"W
const DEFAULT_FOCUS = { lat: 38.7503611111, lng: -9.1474444444 };
const DEFAULT_ZOOM = 18;
const TILES = 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/attribution/" target="_blank">Stadia Maps</a> ' +
  '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> ' +
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

type MapCenter = { lat: number; lng: number };

interface MapProps {
  pins?: Pin[];
  mode?: 'view' | 'edit';
  focus?: { lat: number; lng: number; n: number } | null;
  initialCenter?: MapCenter;
  center?: MapCenter | null;
  zoom?: number;
  onSelect?: (pin: Pin) => void;
  onMapClick?: (location: MapCenter) => void;
}

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function popupHtml(pin: Pin): string {
  const chips = pin.sweets
    .map((sweet) => `<span class="chip">${escapeHtml(sweetEmoji(sweet))} ${escapeHtml(sweetLabel(sweet))}</span>`)
    .join(' ');
  const dateLine = pin.date === eventDate() ? '' : `<p class="p-date">${escapeHtml(formatDate(pin.date))}</p>`;
  const floorDoorLine = pin.floor_door
    ? `<p class="p-addr">🚪 ${escapeHtml(pin.floor_door)}</p>`
    : '';
  const notesLine = pin.notes ? `<p class="p-addr">📝 ${escapeHtml(pin.notes)}</p>` : '';

  return `
    <div class="pin-popup">
      <h3>${escapeHtml(pin.name)}</h3>
      ${dateLine}
      <p class="p-addr">📍 ${escapeHtml(pin.address)}</p>
      ${floorDoorLine}
      ${notesLine}
      <p class="p-time">⏰ ${escapeHtml(formatTime(pin.start_time))} – ${escapeHtml(formatTime(pin.end_time))}</p>
      <div class="chips">${chips}</div>
      <a class="p-dir" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pin.address)}" target="_blank" rel="noreferrer">Como chegar</a>
    </div>`;
}

export default function Map({
  pins = [],
  mode = 'view',
  focus = null,
  initialCenter = DEFAULT_FOCUS,
  center = null,
  zoom = DEFAULT_ZOOM,
  onSelect = () => {},
  onMapClick = () => {},
}: MapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element) return;

    const map = L.map(element, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom,
      minZoom: 6,
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 20 }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = markersLayer;

    if (mode === 'edit') {
      map.on('click', (event: L.LeafletMouseEvent) => {
        onMapClickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.clearLayers();
    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng], { icon: pumpkinIcon });
      marker.bindPopup(popupHtml(pin));
      marker.on('click', () => onSelectRef.current(pin));
      marker.addTo(markersLayer);
    }
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;

    const target = L.latLng(center.lat, center.lng);
    if (!map.getCenter().equals(target)) {
      map.flyTo(target, map.getZoom(), { duration: 0.8 });
    }
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [focus]);

  return <div className="map" ref={mapElementRef} />;
}
