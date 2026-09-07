import { googleProvider } from './googleProvider';
import { leafletProvider } from './leafletProvider';
import { resolveProvider } from './provider';
import type { MapProvider } from './types';

/** The mapping stack this build runs on, decided once from the environment. */
export function mapProvider(): MapProvider {
  return resolveProvider() === 'google' ? googleProvider : leafletProvider;
}

export { resolveProvider };
export * from './types';
