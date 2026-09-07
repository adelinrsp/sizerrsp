import type { ProviderId } from './types';

/**
 * Which mapping stack to use. Google is the default: a deployment missing its
 * key must fail loudly rather than quietly serve the OSM stack in production.
 * The keyless stack is opt-in, via `NEXT_PUBLIC_MAP_PROVIDER=osm`.
 */
export function resolveProvider(): ProviderId {
  return process.env.NEXT_PUBLIC_MAP_PROVIDER?.trim().toLowerCase() === 'osm'
    ? 'osm'
    : 'google';
}

export const IS_GOOGLE = resolveProvider() === 'google';
