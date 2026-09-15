// Geocodificação via Photon (dados do OpenStreetMap).
// Usamos o Photon em vez do Nominatim diretamente: a política de utilização do
// Nominatim proíbe autocomplete no browser (sem User-Agent, limite agregado de 1 req/s).

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
  };
}

const searchCache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, string>();

function buildLabel(p: PhotonFeature['properties'] | undefined): string {
  if (!p) return '';
  const street = p.street ? (p.housenumber ? `${p.street} ${p.housenumber}` : p.street) : p.name;
  return [street, p.city, p.postcode].filter(Boolean).join(', ');
}

export async function searchAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const q = query.trim();
  const cached = searchCache.get(q);
  if (cached) return cached;

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=pt`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('geocode_failed');

  const data = (await res.json()) as { features: PhotonFeature[] };
  const results = (data.features ?? []).map((f) => ({
    label:
      buildLabel(f.properties) ||
      `${f.geometry.coordinates[1].toFixed(5)}, ${f.geometry.coordinates[0].toFixed(5)}`,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));

  searchCache.set(q, results);
  return results;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=pt`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('geocode_failed');

  const data = (await res.json()) as { features: PhotonFeature[] };
  const label = buildLabel(data.features?.[0]?.properties);
  reverseCache.set(key, label);
  return label;
}
