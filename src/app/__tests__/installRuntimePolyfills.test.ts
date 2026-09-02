import {TextDecoder as ExodusTextDecoder} from '@exodus/bytes/encoding-lite.js';

import {installRuntimePolyfills} from '../installRuntimePolyfills';

describe('runtime polyfills', () => {
  it('installs TextDecoder when the runtime does not provide it', () => {
    const runtime: {TextDecoder?: unknown} = {};

    installRuntimePolyfills(runtime);

    expect(runtime.TextDecoder).toBe(ExodusTextDecoder);
    const Decoder = runtime.TextDecoder as typeof ExodusTextDecoder;
    expect(
      new Decoder('utf8').decode(
        new Uint8Array([0x66, 0x72, 0x65, 0x73, 0x6e, 0x69, 0x63, 0x61]),
      ),
    ).toBe('fresnica');
  });

  it('preserves a runtime-provided TextDecoder', () => {
    class ExistingTextDecoder {}
    const runtime = {TextDecoder: ExistingTextDecoder};

    installRuntimePolyfills(runtime);

    expect(runtime.TextDecoder).toBe(ExistingTextDecoder);
  });

  it('installs Array.prototype.flatMap when the runtime does not provide it', () => {
    const prototype: {flatMap?: unknown} = {};
    const runtime = {Array: {prototype}};

    installRuntimePolyfills(runtime);

    const flatMap = prototype.flatMap as (
      this: number[],
      callback: (value: number) => number[],
    ) => unknown[];
    expect(flatMap.call([1, 2], value => [value, value * 10])).toEqual([
      1,
      10,
      2,
      20,
    ]);
  });

  it('preserves a runtime-provided Array.prototype.flatMap', () => {
    const existingFlatMap = () => ['existing'];
    const runtime = {Array: {prototype: {flatMap: existingFlatMap}}};

    installRuntimePolyfills(runtime);

    expect(runtime.Array.prototype.flatMap).toBe(existingFlatMap);
  });
});
