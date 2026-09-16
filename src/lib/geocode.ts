// Geocode through the OpenRouteService-backed Edge Function. Keeping the API key
// in the function means it is never bundled into the browser application.

import { supabase } from './supabase';

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

interface GeocodeResponse {
  results?: GeocodeResult[];
  error?: string;
}

const searchCache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, string>();

async function requestGeocode(body: Record<string, unknown>, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const { data, error } = await supabase.functions.invoke<GeocodeResponse>('geocode', {
    body,
    signal,
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    const responseError =
      typeof context === 'object' && context !== null
        ? (context as GeocodeResponse).error
        : undefined;
    throw new Error(responseError ?? 'geocode_failed');
  }
  if (data?.error) throw new Error(data.error);
  return data?.results ?? [];
}

export async function searchAddress(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const q = query.trim();
  const cached = searchCache.get(q);
  if (cached) return cached;

  const results = await requestGeocode({ type: 'autocomplete', query: q }, signal);

  searchCache.set(q, results);
  return results;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  const [result] = await requestGeocode({ type: 'reverse', lat, lng });
  const label = result?.label ?? '';
  reverseCache.set(key, label);
  return label;
}
