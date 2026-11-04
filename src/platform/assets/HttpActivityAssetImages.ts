import type { ActivityAssetImages } from '../../capabilities/assets/ActivityAssetImages';
import { normalizeUntrustedDappUrl } from '../../capabilities/dapp-interaction/externalDappUrl';
import {
  curatedAssetSourcesForNetwork,
  normalizeCuratedAssets,
  type AssetCatalogPort,
  type CuratedAsset,
} from '../../capabilities/trustline/curatedAssetCatalog';

const MAX_BYTES = 65_536;
const TTL_MS = 600_000;
const DEADLINE_MS = 6_000;
const MAX_WAITING = 32;

function imageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const valid = (width: number, height: number) => width > 0 && height > 0 && width <= 512 && height <= 512;
  if (
    bytes.length >= 33 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) &&
    view.getUint32(8) === 13 &&
    view.getUint32(12) === 0x49484452
  ) {
    return valid(view.getUint32(16), view.getUint32(20)) ? 'image/png' : undefined;
  }
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return undefined;
  for (let offset = 2; offset + 4 <= bytes.length;) {
    if (bytes[offset++] !== 255) return undefined;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 217 || marker === 218) return undefined;
    if (offset + 2 > bytes.length) return undefined;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if ([192, 193, 194].includes(marker))
      return length >= 8 && valid(view.getUint16(offset + 5), view.getUint16(offset + 3)) ? 'image/jpeg' : undefined;
    offset += length;
  }
  return undefined;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    result += B64[Math.floor(a / 4)] + B64[(a % 4) * 16 + Math.floor((b ?? 0) / 16)];
    result += b === undefined ? '=' : B64[(b % 16) * 4 + Math.floor((c ?? 0) / 64)];
    result += c === undefined ? '=' : B64[c % 64];
  }
  return result;
}

async function boundedBytes(response: Response, signal: AbortSignal): Promise<Uint8Array | undefined> {
  const reader = response.body?.getReader?.();
  // Some native fetch implementations have no streaming reader. Never buffer
  // their entire response: Content-Length may be missing or incorrect.
  if (!reader) return undefined;
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) return undefined;
      parts.push(value);
    }
    if (signal.aborted) return undefined;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    return bytes;
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

type SourceMetadata = Readonly<{ expires: number; assets: readonly CuratedAsset[]; ambiguous: ReadonlySet<string> }>;

function parseMetadata(body: string, expires: number): SourceMetadata | undefined {
  if (body.length > 1_000_000) return undefined;
  const parsed: unknown = JSON.parse(body);
  const assets = normalizeCuratedAssets(parsed).slice(0, 2000);
  const root =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  const embedded =
    root?._embedded && typeof root._embedded === 'object' ? (root._embedded as Record<string, unknown>) : undefined;
  const items = Array.isArray(parsed)
    ? parsed
    : [
        ...(Array.isArray(root?.assets) ? root.assets : []),
        ...(Array.isArray(root?.tokens) ? root.tokens : []),
        ...(Array.isArray(root?.records) ? root.records : []),
        ...(Array.isArray(embedded?.records) ? embedded.records : []),
      ];
  const seen = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const record of items.slice(0, 2000)) {
    const match = normalizeCuratedAssets([record])[0];
    if (!match) continue;
    const key = JSON.stringify([match.code, match.issuer]);
    const icon = match.icon ?? '';
    const previous = seen.get(key);
    if (previous !== undefined && previous !== icon) ambiguous.add(key);
    seen.set(key, icon);
  }
  return { expires, assets, ambiguous };
}

export function createHttpActivityAssetImages(
  catalog: AssetCatalogPort,
  http: typeof fetch = fetch,
  now: () => number = Date.now,
): ActivityAssetImages {
  const catalogCache = new Map<string, SourceMetadata>();
  const imageCache = new Map<string, { expires: number; data: string }>();
  const waiting = new Set<() => void>();
  let active = 0;

  async function acquire(signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return false;
    if (active < 2) {
      active++;
      return true;
    }
    if (waiting.size >= MAX_WAITING) return false;
    return new Promise<boolean>(resolve => {
      const start = () => {
        waiting.delete(start);
        signal.removeEventListener('abort', stop);
        if (signal.aborted) resolve(false);
        else {
          active++;
          resolve(true);
        }
      };
      const stop = () => {
        waiting.delete(start);
        signal.removeEventListener('abort', stop);
        resolve(false);
      };
      waiting.add(start);
      signal.addEventListener('abort', stop, { once: true });
      if (signal.aborted) stop();
    });
  }
  function release() {
    active--;
    const next = waiting.values().next().value;
    if (next) {
      waiting.delete(next);
      next();
    }
  }

  return {
    async resolve(networkId, asset, signal) {
      if (signal.aborted || asset.kind !== 'credit') return undefined;
      const sources = curatedAssetSourcesForNetwork(networkId);
      if (!sources.length) return undefined;
      const key = JSON.stringify([networkId, asset.code, asset.issuer]);
      const cached = imageCache.get(key);
      if (cached && cached.expires > now()) return cached.data;

      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      let timeout: ReturnType<typeof setTimeout>;
      const deadline = new Promise<undefined>(resolve => {
        timeout = setTimeout(() => {
          cancel();
          resolve(undefined);
        }, DEADLINE_MS);
      });

      const load = async (): Promise<string | undefined> => {
        if (!(await acquire(controller.signal))) return undefined;
        try {
          let icon: string | undefined;
          for (const source of sources) {
            if (controller.signal.aborted) return undefined;
            try {
              let metadata = catalogCache.get(source.url);
              if (!metadata || metadata.expires <= now()) {
                const body = await catalog.read(source.url, controller.signal);
                if (controller.signal.aborted) return undefined;
                metadata = parseMetadata(body, now() + TTL_MS);
                if (!metadata) continue;
                catalogCache.set(source.url, metadata);
              }
              const assetKey = JSON.stringify([asset.code, asset.issuer]);
              if (metadata.ambiguous.has(assetKey)) continue;
              icon = metadata.assets.find(item => item.code === asset.code && item.issuer === asset.issuer)?.icon;
              if (icon) break;
            } catch {
              // A malformed source is not an asset risk verdict.
            }
          }
          if (!icon || controller.signal.aborted || !/^https:\/\//i.test(icon)) return undefined;
          const { url } = normalizeUntrustedDappUrl(icon);
          if (new URL(url).port !== '') return undefined;
          const response = await http(url, {
            signal: controller.signal,
            redirect: 'error',
            credentials: 'omit',
          });
          if (
            controller.signal.aborted ||
            !response.ok ||
            response.redirected ||
            (response.url && response.url !== url) ||
            Number(response.headers.get('Content-Length') ?? 0) > MAX_BYTES
          )
            return undefined;
          const bytes = await boundedBytes(response, controller.signal);
          if (!bytes) return undefined;
          const mime = imageMime(bytes);
          if (!mime) return undefined;
          const data = `data:${mime};base64,${toBase64(bytes)}`;
          if (controller.signal.aborted) return undefined;
          imageCache.delete(key);
          imageCache.set(key, { expires: now() + TTL_MS, data });
          while (imageCache.size > 32) {
            const oldest = imageCache.keys().next().value;
            if (oldest) imageCache.delete(oldest);
            else break;
          }
          return data;
        } catch {
          return undefined;
        } finally {
          release();
        }
      };

      try {
        return await Promise.race([load(), deadline]);
      } finally {
        clearTimeout(timeout!);
        cancel();
        signal.removeEventListener('abort', cancel);
      }
    },
  };
}
