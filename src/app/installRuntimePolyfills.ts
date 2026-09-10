import {TextDecoder as ExodusTextDecoder} from '@exodus/bytes/encoding-lite.js';

type RuntimeArrayPrototype = {
  flatMap?: unknown;
};

type UrlInstance = {
  href: string;
  pathname: string;
  protocol: string;
  host: string;
  toString(): string;
};

type UrlConstructor = {
  new (url: string, base?: string): UrlInstance;
  prototype: object;
};

type RuntimeGlobal = {
  TextDecoder?: unknown;
  Array?: {
    prototype?: RuntimeArrayPrototype;
  };
  URL?: UrlConstructor;
};

type FlatMapCallback = (
  value: unknown,
  index: number,
  array: unknown[],
) => unknown;

type MutableHrefUrl = {
  _url?: unknown;
  _searchParamsInstance?: unknown;
};

function flatMapFallback(
  this: unknown[],
  callback: FlatMapCallback,
  thisArg?: unknown,
): unknown[] {
  if (typeof callback !== 'function') {
    throw new TypeError('flatMap callback must be a function');
  }

  const result: unknown[] = [];
  for (let index = 0; index < this.length; index += 1) {
    if (!(index in this)) {
      continue;
    }

    const mapped = callback.call(thisArg, this[index], index, this);
    if (Array.isArray(mapped)) {
      result.push(...mapped);
    } else {
      result.push(mapped);
    }
  }
  return result;
}

function coerceUrlInput(value: unknown, URLCtor: UrlConstructor): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof URLCtor) {
    return value.toString();
  }
  if (value !== null && typeof value === 'object' && 'href' in value) {
    const href = (value as {href: unknown}).href;
    if (typeof href === 'string') {
      return href;
    }
  }
  return String(value);
}

function replacePathname(href: string, pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const match = href.match(/^(https?:\/\/[^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i);
  if (!match) {
    return href;
  }
  return `${match[1]}${normalized}${match[3] ?? ''}${match[4] ?? ''}`;
}

function replaceProtocol(href: string, protocol: string): string {
  const normalized = protocol.endsWith(':') ? protocol : `${protocol}:`;
  return href.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:/, normalized);
}

function replaceHost(href: string, host: string): string {
  return href.replace(/^(https?:\/\/)(?:[^@/]+@)?([^/?#]+)/i, `$1${host}`);
}

function writeHref(target: object, href: string): void {
  const mutable = target as MutableHrefUrl;
  if (typeof mutable._url !== 'string') {
    return;
  }
  mutable._url = href;
  mutable._searchParamsInstance = null;
}

function hasSetter(prototype: object, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
  return typeof descriptor?.set === 'function';
}

function defineUrlSetter(
  prototype: object,
  key: 'pathname' | 'protocol' | 'host',
  rewrite: (href: string, value: string) => string,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
  if (!descriptor?.get || typeof descriptor.set === 'function') {
    return;
  }

  Object.defineProperty(prototype, key, {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(this: object, value: string) {
      const current = (this as MutableHrefUrl)._url;
      if (typeof current !== 'string') {
        return;
      }
      writeHref(this, rewrite(current, String(value)));
    },
  });
}

function urlRuntimeNeedsCompat(URLCtor: UrlConstructor): boolean {
  try {
    const created = new URLCtor('https://example.test/accounts');
    const cloned = new URLCtor(created as unknown as string);
    if (!cloned.toString().includes('/accounts')) {
      return true;
    }
    cloned.pathname = '/ledger';
    if (!cloned.toString().includes('/ledger')) {
      return true;
    }
    cloned.host = 'horizon.test';
    cloned.protocol = 'https:';
    return !cloned.toString().startsWith('https://horizon.test/ledger');
  } catch {
    return true;
  }
}

function wrapUrlConstructor(OriginalURL: UrlConstructor): UrlConstructor {
  function CompatibleURL(url: unknown, base?: unknown): UrlInstance {
    const coercedUrl = coerceUrlInput(url, OriginalURL);
    if (base === undefined) {
      return new OriginalURL(coercedUrl);
    }
    return new OriginalURL(coercedUrl, coerceUrlInput(base, OriginalURL));
  }

  Object.setPrototypeOf(CompatibleURL, OriginalURL);
  CompatibleURL.prototype = OriginalURL.prototype;
  Object.defineProperty(CompatibleURL, 'name', {value: 'URL'});
  return CompatibleURL as unknown as UrlConstructor;
}

function installUrlCompat(runtimeGlobal: RuntimeGlobal): void {
  const OriginalURL = runtimeGlobal.URL;
  if (typeof OriginalURL !== 'function' || !urlRuntimeNeedsCompat(OriginalURL)) {
    return;
  }

  runtimeGlobal.URL = wrapUrlConstructor(OriginalURL);

  const prototype = OriginalURL.prototype;
  if (!hasSetter(prototype, 'pathname')) {
    defineUrlSetter(prototype, 'pathname', replacePathname);
  }
  if (!hasSetter(prototype, 'protocol')) {
    defineUrlSetter(prototype, 'protocol', replaceProtocol);
  }
  if (!hasSetter(prototype, 'host')) {
    defineUrlSetter(prototype, 'host', replaceHost);
  }
}

export function installRuntimePolyfills(
  runtimeGlobal: RuntimeGlobal = globalThis,
): void {
  if (typeof runtimeGlobal.TextDecoder !== 'function') {
    runtimeGlobal.TextDecoder = ExodusTextDecoder;
  }

  const arrayPrototype = runtimeGlobal.Array?.prototype;
  if (arrayPrototype && typeof arrayPrototype.flatMap !== 'function') {
    Object.defineProperty(arrayPrototype, 'flatMap', {
      configurable: true,
      writable: true,
      value: flatMapFallback,
    });
  }

  installUrlCompat(runtimeGlobal);
}

installRuntimePolyfills();
