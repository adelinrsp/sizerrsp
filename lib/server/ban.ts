import type { AddressSuggestion } from '../types';

/**
 * Base Adresse Nationale — the French government's address search. Free, no
 * key, France-only, and it returns coordinates with every suggestion, so the
 * OSM stack needs no separate geocoding call.
 */
const BAN_SEARCH = 'https://api-adresse.data.gouv.fr/search/';

type BanFeature = {
  properties?: { id?: string; label?: string };
  geometry?: { coordinates?: [number, number] };
};

export async function banAutocomplete(q: string): Promise<AddressSuggestion[]> {
  const url = `${BAN_SEARCH}?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`API Adresse a répondu ${res.status}.`);

  const data = (await res.json()) as { features?: BanFeature[] };

  return (data.features || [])
    .map((f): AddressSuggestion | null => {
      const label = f.properties?.label;
      const coords = f.geometry?.coordinates;
      if (!label || !coords) return null;
      return {
        placeId: f.properties?.id || `${coords[1]},${coords[0]}`,
        label,
        lat: coords[1],
        lng: coords[0],
      };
    })
    .filter((s): s is AddressSuggestion => s !== null)
    .slice(0, 5);
}
