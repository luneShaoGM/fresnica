import { TextDecoder as ExodusTextDecoder } from '@exodus/bytes/encoding-lite.js';

import { installRuntimePolyfills } from '../installRuntimePolyfills';

describe('runtime polyfills', () => {
  it('installs TextDecoder when the runtime does not provide it', () => {
    const runtime: { TextDecoder?: unknown } = {};

    installRuntimePolyfills(runtime);

    expect(runtime.TextDecoder).toBe(ExodusTextDecoder);
    const Decoder = runtime.TextDecoder as typeof ExodusTextDecoder;
    expect(new Decoder('utf8').decode(new Uint8Array([0x66, 0x72, 0x65, 0x73, 0x6e, 0x69, 0x63, 0x61]))).toBe(
      'fresnica',
    );
  });

  it('preserves a runtime-provided TextDecoder', () => {
    class ExistingTextDecoder {}
    const runtime = { TextDecoder: ExistingTextDecoder };

    installRuntimePolyfills(runtime);

    expect(runtime.TextDecoder).toBe(ExistingTextDecoder);
  });

  it('installs Array.prototype.flatMap when the runtime does not provide it', () => {
    const prototype: { flatMap?: unknown } = {};
    const runtime = { Array: { prototype } };

    installRuntimePolyfills(runtime);

    const flatMap = prototype.flatMap as (this: number[], callback: (value: number) => number[]) => unknown[];
    expect(flatMap.call([1, 2], value => [value, value * 10])).toEqual([1, 10, 2, 20]);
  });

  it('preserves a runtime-provided Array.prototype.flatMap', () => {
    const existingFlatMap = () => ['existing'];
    const runtime = { Array: { prototype: { flatMap: existingFlatMap } } };

    installRuntimePolyfills(runtime);

    expect(runtime.Array.prototype.flatMap).toBe(existingFlatMap);
  });

  it('preserves a WHATWG-complete URL implementation', () => {
    const runtime = { URL };

    installRuntimePolyfills(runtime);

    expect(runtime.URL).toBe(URL);
  });

  it('makes React Native URL cloning and path assignment usable by Horizon', () => {
    const runtime = { URL: ReactNativeLikeURL };

    expect(() => {
      new ReactNativeLikeURL(new ReactNativeLikeURL('https://horizon-testnet.stellar.org') as unknown as string);
    }).toThrow(/is not a function/);

    installRuntimePolyfills(runtime);

    type WritableUrl = {
      pathname: string;
      protocol: string;
      host: string;
      toString(): string;
    };

    const serverUrl = new runtime.URL('https://horizon-testnet.stellar.org');
    const accountsUrl = new runtime.URL(serverUrl as unknown as string) as WritableUrl;
    accountsUrl.pathname = 'accounts';
    expect(accountsUrl.toString()).toBe('https://horizon-testnet.stellar.org/accounts');

    const accountUrl = new runtime.URL(accountsUrl as unknown as string) as WritableUrl;
    accountUrl.pathname = 'accounts/GTESTACCOUNT';
    accountUrl.protocol = accountsUrl.protocol;
    accountUrl.host = accountsUrl.host;
    expect(accountUrl.toString()).toBe('https://horizon-testnet.stellar.org/accounts/GTESTACCOUNT');
  });

  it('preserves React Native search params when Horizon rewrites the pathname', () => {
    const runtime = reactNativeUrlRuntime();
    installRuntimePolyfills(runtime);

    const url = new runtime.URL('https://horizon-testnet.stellar.org/operations#fragment');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('limit', '20');
    url.pathname = '/accounts/GTESTACCOUNT/operations';

    expect(url.toString()).toBe(
      'https://horizon-testnet.stellar.org/accounts/GTESTACCOUNT/operations?order=desc&limit=20#fragment',
    );
  });

  it('does not duplicate an existing query when React Native pathname is rewritten', () => {
    const runtime = reactNativeUrlRuntime();
    installRuntimePolyfills(runtime);

    const url = new runtime.URL('https://horizon-testnet.stellar.org/operations?existing=1#fragment');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('limit', '20');
    url.pathname = '/accounts/GTESTACCOUNT/operations';
    url.pathname = '/accounts/GTESTACCOUNT/operations';

    expect(url.toString()).toBe(
      'https://horizon-testnet.stellar.org/accounts/GTESTACCOUNT/operations?existing=1&order=desc&limit=20#fragment',
    );
    expect(url.toString().match(/\?/gu)).toHaveLength(1);
  });
});

type ReactNativeUrlLike = {
  href: string;
  pathname: string;
  protocol: string;
  host: string;
  searchParams: {
    set(name: string, value: string): void;
  };
  toString(): string;
};

type ReactNativeUrlConstructor = {
  new (url: string, base?: string | ReactNativeUrlLike): ReactNativeUrlLike;
  prototype: object;
};

function reactNativeUrlRuntime(): { URL: ReactNativeUrlConstructor } {
  return jest.requireActual('react-native/Libraries/Blob/URL') as {
    URL: ReactNativeUrlConstructor;
  };
}

class ReactNativeLikeURL {
  _url: string;
  _searchParamsInstance: unknown = null;

  constructor(url: string) {
    this._url = url;
    if (this._url.includes('#')) {
      this._url = this._url;
    }
  }

  get href(): string {
    return this.toString();
  }

  get host(): string {
    const hostMatch = this._url.match(/^https?:\/\/(?:[^@]+@)?([^:/?#]+)/);
    const portMatch = this._url.match(/:(\d+)(?=[/?#]|$)/);
    return hostMatch ? hostMatch[1] + (portMatch ? `:${portMatch[1]}` : '') : '';
  }

  get pathname(): string {
    const pathMatch = this._url.match(/https?:\/\/[^/]+(\/[^?#]*)?/);
    return pathMatch ? pathMatch[1] || '/' : '/';
  }

  get protocol(): string {
    const protocolMatch = this._url.match(/^([a-zA-Z][a-zA-Z\d+\-.]*):/);
    return protocolMatch ? `${protocolMatch[1]}:` : '';
  }

  toString(): string {
    return this._url;
  }
}
