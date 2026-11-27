import { createAvatar } from '@dicebear/core';
import * as identicon from '@dicebear/identicon';

// Fixed style and package versions keep the full public-address seed stable across themes.
const cache = new Map<string, string>();
export function accountIdenticon(seed: string): string | undefined {
  if (!/^(?:G[A-Z2-7]{55}|M[A-Z2-7]{68})$/.test(seed)) return undefined;
  const cached = cache.get(seed);
  if (cached) return cached;
  const xml = createAvatar(identicon, {
    seed,
    backgroundColor: ['f1f5f9'],
    clip: false,
  })
    .toString()
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/g, '')
    .replace(/\s+shape-rendering=(["'])crispEdges\1/g, '');
  cache.set(seed, xml);
  if (cache.size > 128) cache.delete(cache.keys().next().value!);
  return xml;
}
