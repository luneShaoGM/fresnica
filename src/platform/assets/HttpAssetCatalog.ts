import { normalizeUntrustedDappUrl } from '../../capabilities/dapp-interaction/externalDappUrl';
import type { AssetCatalogPort } from '../../capabilities/trustline/curatedAssetCatalog';

export function createHttpAssetCatalog(http: typeof fetch = fetch): AssetCatalogPort {
  return {
    async read(input, signal) {
      const { url } = normalizeUntrustedDappUrl(input);
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (signal.aborted) controller.abort();
      signal.addEventListener('abort', abort);
      const timer = setTimeout(abort, 10_000);
      try {
        const response = await http(url, { signal: controller.signal, redirect: 'error' });
        if (!response.ok || Number(response.headers.get('Content-Length') ?? 0) > 1_000_000) {
          throw new Error('asset-catalog-unavailable');
        }
        const body = await response.text();
        if (controller.signal.aborted || body.length > 1_000_000) throw new Error('asset-catalog-unavailable');
        return body;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
      }
    },
  };
}
