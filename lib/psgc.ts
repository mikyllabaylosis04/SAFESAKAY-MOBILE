import { getApiBaseUrls } from '@/lib/config';

export type GeoItem = {
  code: string;
  name: string;
};

export type PickedAddress = {
  address: string;
  region: string;
  province: string;
  city: string;
  barangay: string;
};

const PSGC_BASE = 'https://psgc.gitlab.io/api';

const FALLBACK_ISLAND_GROUPS: GeoItem[] = [
  { code: 'luzon', name: 'Luzon' },
  { code: 'visayas', name: 'Visayas' },
  { code: 'mindanao', name: 'Mindanao' },
];

function parseGeoItems(payload: unknown): GeoItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => {
      if (!item || typeof item !== 'object' || !('code' in item) || !('name' in item)) {
        return null;
      }

      const code = String((item as { code: unknown }).code);
      const rawName = String((item as { name: unknown }).name);
      const oldName =
        'oldName' in item && typeof (item as { oldName: unknown }).oldName === 'string'
          ? (item as { oldName: string }).oldName.trim()
          : '';
      const name = oldName ? `${rawName} (${oldName})` : rawName;

      if (code === '' || rawName === '' || rawName === 'undefined') {
        return null;
      }

      return { code, name };
    })
    .filter((item): item is GeoItem => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchJson(url: string): Promise<GeoItem[]> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Unable to load locations.');
  }

  return parseGeoItems(await response.json());
}

function psgcPath(type: string, code = ''): string | null {
  switch (type) {
    case 'island-groups':
      return '/island-groups/';
    case 'island-provinces':
      return `/island-groups/${code}/provinces/`;
    case 'cities':
      return `/provinces/${code}/cities-municipalities/`;
    case 'barangays':
      return `/cities-municipalities/${code}/barangays/`;
    default:
      return null;
  }
}

export async function fetchLocations(type: string, code = ''): Promise<GeoItem[]> {
  const path = psgcPath(type, code);

  if (!path || (type !== 'island-groups' && code === '')) {
    throw new Error('Invalid location request.');
  }

  try {
    const items = await fetchJson(`${PSGC_BASE}${path}`);
    if (items.length > 0) {
      return items;
    }
  } catch {
    // Fall through to Laravel proxy.
  }

  const params = new URLSearchParams({ type });
  if (code) {
    params.set('code', code);
  }

  for (const base of getApiBaseUrls()) {
    try {
      const items = await fetchJson(`${base}/api/locations?${params.toString()}`);
      if (items.length > 0) {
        return items;
      }
    } catch {
      // Try the next API host.
    }
  }

  if (type === 'island-groups') {
    return FALLBACK_ISLAND_GROUPS;
  }

  return [];
}
