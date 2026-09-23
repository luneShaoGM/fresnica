import type { NetworkContext } from '../../network/types';
import {
  buildRequestUri,
  parseRequestInput,
  PUBLIC_NETWORK_PASSPHRASE,
  type RequestUriDependencies,
} from '../requestUri';

const PUBLIC_NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-mainnet',
  networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
});
const TEST_NETWORK: NetworkContext = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const destination = 'GDESTINATION';
const issuer = 'GISSUER';
const muxedDestination = 'MDESTINATION';

function dependencies(currentNetwork: NetworkContext): RequestUriDependencies {
  return {
    currentNetwork,
    isClassicAccountAddress: value => value.startsWith('G'),
  };
}

describe('Request URI domain', () => {
  it('builds canonical public address-only SEP-7 and accepts plain Classic addresses', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    const uri = buildRequestUri(deps, { destination, network: PUBLIC_NETWORK });
    expect(uri).toBe('web+stellar:pay?destination=GDESTINATION');
    expect(parseRequestInput(deps, uri)).toEqual({
      status: 'accepted',
      intent: {
        syntax: 'sep7-pay',
        destination,
        asset: { kind: 'native' },
        networkId: PUBLIC_NETWORK.id,
        networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
      },
      diagnostics: { outcome: 'accepted', category: 'payment-request' },
    });
    expect(parseRequestInput(deps, `  ${destination}  `)).toEqual({
      status: 'accepted',
      intent: {
        syntax: 'address',
        destination,
        asset: { kind: 'native' },
        networkId: PUBLIC_NETWORK.id,
        networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
      },
      diagnostics: { outcome: 'accepted', category: 'payment-request' },
    });
  });

  it('round-trips exact amount, issued asset, text memo, message and non-Public network', () => {
    const deps = dependencies(TEST_NETWORK);
    const uri = buildRequestUri(deps, {
      destination,
      amount: '12.3400000',
      asset: { kind: 'credit', code: 'usd', issuer },
      memo: { type: 'text', value: ' memo ' },
      message: 'Invoice 42',
      network: TEST_NETWORK,
    });
    expect(uri).toBe(
      'web+stellar:pay?destination=GDESTINATION&amount=12.3400000&asset_code=usd&asset_issuer=GISSUER&memo=%20memo%20&memo_type=MEMO_TEXT&msg=Invoice%2042&network_passphrase=Test%20SDF%20Network%20%3B%20September%202015',
    );
    expect(parseRequestInput(deps, uri)).toMatchObject({
      status: 'accepted',
      intent: {
        syntax: 'sep7-pay',
        destination,
        amount: '12.3400000',
        asset: { kind: 'credit', code: 'usd', issuer },
        memo: { type: 'text', value: ' memo ' },
        message: 'Invoice 42',
        networkId: TEST_NETWORK.id,
        networkPassphrase: TEST_NETWORK.networkPassphrase,
      },
    });
  });

  it('canonicalizes ID memo and uses exact base64 wire encoding for Hash memo', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    const idUri = buildRequestUri(deps, {
      destination,
      memo: { type: 'id', value: '0007' },
      network: PUBLIC_NETWORK,
    });
    expect(idUri).toContain('memo=7&memo_type=MEMO_ID');

    const hash = '00'.repeat(32);
    const expectedBase64 = Buffer.from(hash, 'hex').toString('base64');
    const hashUri = buildRequestUri(deps, {
      destination,
      memo: { type: 'hash', value: hash },
      network: PUBLIC_NETWORK,
    });
    expect(hashUri).toContain(`memo=${encodeURIComponent(expectedBase64)}&memo_type=MEMO_HASH`);
    expect(hashUri).not.toContain(hash);
    expect(parseRequestInput(deps, hashUri)).toMatchObject({
      status: 'accepted',
      intent: { memo: { type: 'hash', value: hash } },
    });
  });

  it('rejects malformed or non-32-byte Hash wire values', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    for (const memo of ['not-base64', Buffer.from('short').toString('base64')]) {
      const uri = `web+stellar:pay?destination=${destination}&memo=${encodeURIComponent(memo)}&memo_type=MEMO_HASH`;
      expect(parseRequestInput(deps, uri)).toMatchObject({ status: 'rejected', reason: 'invalid-memo' });
    }
  });

  it('enforces the signed-int64 amount ceiling in both build and parse', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    const max = '922337203685.4775807';

    expect(
      buildRequestUri(deps, {
        destination,
        amount: max,
        network: PUBLIC_NETWORK,
      }),
    ).toContain(`amount=${max}`);
    expect(parseRequestInput(deps, `web+stellar:pay?destination=${destination}&amount=${max}`)).toMatchObject({
      status: 'accepted',
      intent: { amount: max },
    });
    for (const invalid of ['922337203685.4775808', '0', '1.00000001']) {
      expect(() =>
        buildRequestUri(deps, {
          destination,
          amount: invalid,
          network: PUBLIC_NETWORK,
        }),
      ).toThrow('request-invalid-amount');
      expect(parseRequestInput(deps, `web+stellar:pay?destination=${destination}&amount=${invalid}`)).toMatchObject({
        status: 'rejected',
        reason: 'invalid-amount',
      });
    }
  });

  it('requires complete issued-asset identity and preserves code case', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    expect(parseRequestInput(deps, `web+stellar:pay?destination=${destination}&asset_code=usd`)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-asset',
    });

    const parsed = parseRequestInput(
      deps,
      `web+stellar:pay?destination=${destination}&asset_code=usd&asset_issuer=${issuer}`,
    );
    expect(parsed).toMatchObject({
      status: 'accepted',
      intent: { asset: { kind: 'credit', code: 'usd', issuer } },
    });
  });

  it('rejects invalid memo pairing and classifies MEMO_RETURN as unsupported', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    expect(parseRequestInput(deps, `web+stellar:pay?destination=${destination}&memo=7`)).toMatchObject({
      status: 'rejected',
      reason: 'invalid-memo',
    });
    expect(
      parseRequestInput(deps, `web+stellar:pay?destination=${destination}&memo=AAAA&memo_type=MEMO_RETURN`),
    ).toMatchObject({ status: 'unsupported', feature: 'memo-return' });
    expect(
      parseRequestInput(deps, `web+stellar:pay?destination=${destination}&memo=value&memo_type=MEMO_UNKNOWN`),
    ).toMatchObject({ status: 'rejected', reason: 'invalid-memo' });
  });

  it('classifies muxed, tx, callback, signed-origin and unknown operations as unsupported', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    expect(parseRequestInput(deps, muxedDestination)).toMatchObject({
      status: 'unsupported',
      feature: 'muxed-destination',
    });
    expect(() => buildRequestUri(deps, { destination: muxedDestination, network: PUBLIC_NETWORK })).toThrow(
      'request-muxed-destination-unsupported',
    );
    expect(parseRequestInput(deps, 'web+stellar:tx?xdr=AAAA')).toMatchObject({
      status: 'unsupported',
      feature: 'sep7-tx',
    });
    expect(
      parseRequestInput(deps, `web+stellar:pay?destination=${destination}&callback=https%3A%2F%2Fexample.com`),
    ).toMatchObject({ status: 'unsupported', feature: 'callback' });
    expect(
      parseRequestInput(deps, `web+stellar:pay?destination=${destination}&origin_domain=example.com&signature=abc`),
    ).toMatchObject({ status: 'unsupported', feature: 'signed-origin' });
    expect(parseRequestInput(deps, 'web+stellar:swap?destination=GDESTINATION')).toMatchObject({
      status: 'unsupported',
      feature: 'unsupported-operation',
    });
  });

  it('fails closed on duplicate recognized parameters', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    expect(parseRequestInput(deps, `web+stellar:pay?destination=${destination}&amount=1&amount=2`)).toMatchObject({
      status: 'rejected',
      reason: 'duplicate-parameter',
    });
  });

  it('resolves missing network_passphrase as Public and rejects network mismatch', () => {
    const publicDeps = dependencies(PUBLIC_NETWORK);
    const testDeps = dependencies(TEST_NETWORK);
    const publicUri = `web+stellar:pay?destination=${destination}`;
    const testUri = buildRequestUri(testDeps, { destination, network: TEST_NETWORK });

    expect(parseRequestInput(publicDeps, publicUri)).toMatchObject({ status: 'accepted' });
    expect(parseRequestInput(testDeps, publicUri)).toMatchObject({
      status: 'rejected',
      reason: 'network-mismatch',
    });
    expect(parseRequestInput(publicDeps, testUri)).toMatchObject({
      status: 'rejected',
      reason: 'network-mismatch',
    });
    expect(parseRequestInput(testDeps, testUri)).toMatchObject({ status: 'accepted' });
  });

  it('enforces the 300-character request message boundary', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    const valid = 'x'.repeat(300);
    const invalid = 'x'.repeat(301);

    expect(buildRequestUri(deps, { destination, message: valid, network: PUBLIC_NETWORK })).toContain(`msg=${valid}`);
    expect(() => buildRequestUri(deps, { destination, message: invalid, network: PUBLIC_NETWORK })).toThrow(
      'request-message-too-long',
    );
    expect(parseRequestInput(deps, `web+stellar:pay?destination=${destination}&msg=${invalid}`)).toMatchObject({
      status: 'rejected',
      reason: 'message-too-long',
    });
  });

  it('never returns raw untrusted input in parser diagnostics or failures', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    const secret = `S${'A'.repeat(55)}`;
    const mnemonic = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
    const cases = [
      `web+stellar:pay?destination=${destination}&unknown=${encodeURIComponent(secret)}`,
      'web+stellar:pay?destination=%E0%A4%A',
      'https://example.com/request?secret=value',
      secret,
      mnemonic,
    ];
    for (const raw of cases) {
      const result = parseRequestInput(deps, raw);
      const serialized = JSON.stringify(result);
      expect(result.status).not.toBe('accepted');
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(secret);
      expect(serialized).not.toContain('https://example.com');
    }
    expect(parseRequestInput(deps, secret)).toMatchObject({ status: 'rejected', reason: 'sensitive-input' });
    expect(parseRequestInput(deps, mnemonic)).toMatchObject({ status: 'rejected', reason: 'sensitive-input' });
  });

  it('is carrier-neutral so paste, scan and deep-link callers receive the same typed result', () => {
    const deps = dependencies(TEST_NETWORK);
    const uri = buildRequestUri(deps, {
      destination,
      amount: '1',
      memo: { type: 'id', value: '7' },
      network: TEST_NETWORK,
    });

    const paste = parseRequestInput(deps, uri);
    const scan = parseRequestInput(deps, uri);
    const deepLink = parseRequestInput(deps, uri);

    expect(scan).toEqual(paste);
    expect(deepLink).toEqual(paste);
  });

  it('rejects unknown pay parameters without echoing their names or values', () => {
    const deps = dependencies(PUBLIC_NETWORK);
    const raw = `web+stellar:pay?destination=${destination}&path=very-sensitive-value`;
    const result = parseRequestInput(deps, raw);

    expect(result).toMatchObject({ status: 'unsupported', feature: 'unsupported-parameter' });
    expect(JSON.stringify(result)).not.toContain('path');
    expect(JSON.stringify(result)).not.toContain('very-sensitive-value');
  });
});
