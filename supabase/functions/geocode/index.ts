// OpenRouteService geocoding proxy.
//
// Required secret (supabase secrets set):
//   OPENROUTESERVICE_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface OpenRouteFeature {
  geometry?: { coordinates?: unknown };
  properties?: { label?: unknown };
}

interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

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

function toResult(feature: OpenRouteFeature): GeocodeResult | null {
  const coordinates = feature.geometry?.coordinates;
  const label = feature.properties?.label;
  if (!isCoordinate(coordinates) || typeof label !== 'string' || !label.trim()) return null;

  return { label: label.trim(), lng: coordinates[0], lat: coordinates[1] };
}

async function requestOpenRoute(path: string, params: URLSearchParams): Promise<GeocodeResult[]> {
  const apiKey = Deno.env.get('OPENROUTESERVICE_API_KEY');
  if (!apiKey) throw new Error('missing_api_key');

  params.set('api_key', apiKey);
  params.set('boundary.country', 'PT');
  params.set('lang', 'pt');
  params.set('size', path === 'autocomplete' ? '6' : '1');

  const response = await fetch(`https://api.openrouteservice.org/geocode/${path}?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'pt-PT,pt;q=0.9',
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    console.error('openrouteservice_error', response.status);
    throw new Error('openrouteservice_failed');
  }

  const data = (await response.json()) as { features?: unknown };
  const features = Array.isArray(data.features) ? (data.features as OpenRouteFeature[]) : [];
  return features.flatMap((feature) => {
    const result = toResult(feature);
    return result ? [result] : [];
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: Record<string, unknown>;
  try {
    const payload: unknown = await req.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json({ error: 'invalid_body' }, 400);
    }
    body = payload as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  try {
    if (body.type === 'autocomplete') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (query.length < 3 || query.length > 200) return json({ error: 'invalid_query' }, 400);
      return json({
        results: await requestOpenRoute('autocomplete', new URLSearchParams({ text: query })),
      });
    }

    if (body.type === 'reverse') {
      const lat = body.lat;
      const lng = body.lng;
      if (
        typeof lat !== 'number' ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        typeof lng !== 'number' ||
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180
      ) {
        return json({ error: 'invalid_coordinates' }, 400);
      }
      return json({
        results: await requestOpenRoute(
          'reverse',
          new URLSearchParams({ 'point.lat': String(lat), 'point.lon': String(lng) }),
        ),
      });
    }

    return json({ error: 'invalid_request' }, 400);
  } catch (error) {
    console.error('geocode_error', error);
    return json({ error: 'geocode_failed' }, 502);
  }
});
