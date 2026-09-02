import {TextDecoder as ExodusTextDecoder} from '@exodus/bytes/encoding-lite.js';

type RuntimeArrayPrototype = {
  flatMap?: unknown;
};

type RuntimeGlobal = {
  TextDecoder?: unknown;
  Array?: {
    prototype?: RuntimeArrayPrototype;
  };
};

type FlatMapCallback = (
  value: unknown,
  index: number,
  array: unknown[],
) => unknown;

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
}

installRuntimePolyfills();
