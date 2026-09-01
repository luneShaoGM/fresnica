import {TextDecoder as ExodusTextDecoder} from '@exodus/bytes/encoding-lite.js';

type RuntimeGlobal = {
  TextDecoder?: unknown;
};

export function installRuntimePolyfills(
  runtimeGlobal: RuntimeGlobal = globalThis,
): void {
  if (typeof runtimeGlobal.TextDecoder !== 'function') {
    runtimeGlobal.TextDecoder = ExodusTextDecoder;
  }
}

installRuntimePolyfills();
