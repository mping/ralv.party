// Photon is the public Komoot geocoder backed by OpenStreetMap data. It does
// not require an API key; the app keeps its usage debounced and cached.

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: {
    name?: unknown;
    street?: unknown;
    housenumber?: unknown;
    city?: unknown;
    district?: unknown;
    postcode?: unknown;
  };
}

const searchCache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, string>();

function isCoordinate(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildLabel(properties: PhotonFeature['properties']): string {
  const streetName = text(properties?.street);
  const houseNumber = text(properties?.housenumber);
  const street = streetName ? [streetName, houseNumber].filter(Boolean).join(' ') : text(properties?.name);
  const locality = text(properties?.city) || text(properties?.district);
  return [street, locality, text(properties?.postcode)].filter(Boolean).join(', ');
}

function toResult(feature: PhotonFeature): GeocodeResult | null {
  const coordinates = feature.geometry?.coordinates;
  if (!isCoordinate(coordinates)) return null;

  const label =
    buildLabel(feature.properties) ||
    `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  return { label, lat: coordinates[1], lng: coordinates[0] };
}

async function photonRequest(url: URL, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('geocode_failed');

  const data = (await response.json()) as { features?: unknown };
  const features = Array.isArray(data.features) ? (data.features as PhotonFeature[]) : [];
  return features.flatMap((feature) => {
    const result = toResult(feature);
    return result ? [result] : [];
  });
}

export async function searchAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const trimmedQuery = query.trim();
  const cached = searchCache.get(trimmedQuery);
  if (cached) return cached;

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', trimmedQuery);
  url.searchParams.set('limit', '6');
  url.searchParams.set('lang', 'en');
  if (/\d/.test(trimmedQuery)) {
    // Restrict number-containing searches to complete addresses or their street fallback.
    url.searchParams.append('layer', 'house');
    url.searchParams.append('layer', 'street');
  }

  const results = await photonRequest(url, signal);
  searchCache.set(trimmedQuery, results);
  return results;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  const url = new URL('https://photon.komoot.io/reverse');
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lang', 'en');

  const [result] = await photonRequest(url);
  const label = result?.label ?? '';
  reverseCache.set(key, label);
  return label;
}
