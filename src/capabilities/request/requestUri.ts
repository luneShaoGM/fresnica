import type { NetworkContext } from '../network/types';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../stellar/types';
import {
  validateClassicDestination,
  validatePaymentAmount,
  validatePaymentAsset,
  validatePaymentMemo,
} from '../payment/preparePayment';

export const PUBLIC_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

export type RequestUriDependencies = Readonly<{
  currentNetwork: NetworkContext;
  isClassicAccountAddress(address: string): boolean;
}>;

export type RequestUriBuildInput = Readonly<{
  destination: string;
  amount?: string;
  asset?: StellarPaymentAsset;
  memo?: StellarPaymentMemo;
  message?: string;
  network: NetworkContext;
}>;

export type RequestPaymentIntent = Readonly<{
  syntax: 'address' | 'sep7-pay';
  destination: string;
  asset: StellarPaymentAsset;
  amount?: string;
  memo?: StellarPaymentMemo;
  message?: string;
  networkId: string;
  networkPassphrase: string;
}>;
export type RequestRejectedReason =
  | 'empty-input'
  | 'sensitive-input'
  | 'unrecognized-input'
  | 'malformed-uri'
  | 'missing-destination'
  | 'duplicate-parameter'
  | 'invalid-destination'
  | 'invalid-amount'
  | 'invalid-asset'
  | 'invalid-memo'
  | 'message-too-long'
  | 'network-mismatch';

export type RequestUnsupportedFeature =
  | 'muxed-destination'
  | 'sep7-tx'
  | 'unsupported-operation'
  | 'callback'
  | 'signed-origin'
  | 'memo-return'
  | 'unsupported-parameter';

export type RequestParseResult =
  | Readonly<{
      status: 'accepted';
      intent: RequestPaymentIntent;
      diagnostics: Readonly<{ outcome: 'accepted'; category: 'payment-request' }>;
    }>
  | Readonly<{
      status: 'rejected';
      reason: RequestRejectedReason;
      diagnostics: Readonly<{ outcome: 'rejected'; category: RequestRejectedReason }>;
    }>
  | Readonly<{
      status: 'unsupported';
      feature: RequestUnsupportedFeature;
      diagnostics: Readonly<{ outcome: 'unsupported'; category: RequestUnsupportedFeature }>;
    }>;

const SUPPORTED_PARAMETERS = new Set([
  'destination',
  'amount',
  'asset_code',
  'asset_issuer',
  'memo',
  'memo_type',
  'msg',
  'network_passphrase',
]);

export function buildRequestUri(
  dependencies: Pick<RequestUriDependencies, 'isClassicAccountAddress'>,
  input: RequestUriBuildInput,
): string {
  const destination = validateRequestDestination(dependencies, input.destination);
  const amount = input.amount === undefined ? undefined : validateRequestAmount(input.amount);
  const asset = validateRequestAsset(dependencies, input.asset ?? { kind: 'native' });
  const memo = validateRequestMemo(input.memo);
  const message = validateRequestMessage(input.message);
  const pairs: [string, string][] = [['destination', destination]];

  if (amount !== undefined) pairs.push(['amount', amount]);
  if (asset.kind === 'credit') {
    pairs.push(['asset_code', asset.code], ['asset_issuer', asset.issuer]);
  }
  if (memo !== undefined) {
    const wireMemo = memoToWire(memo);
    pairs.push(['memo', wireMemo.value], ['memo_type', wireMemo.type]);
  }
  if (message !== undefined) pairs.push(['msg', message]);
  if (input.network.networkPassphrase !== PUBLIC_NETWORK_PASSPHRASE) {
    pairs.push(['network_passphrase', input.network.networkPassphrase]);
  }

  return `web+stellar:pay?${pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`;
}

export function parseRequestInput(dependencies: RequestUriDependencies, rawInput: string): RequestParseResult {
  const input = rawInput.trim();
  if (input.length === 0) return rejected('empty-input');

  if (dependencies.isClassicAccountAddress(input)) {
    return accepted({
      syntax: 'address',
      destination: input,
      asset: { kind: 'native' },
      networkId: dependencies.currentNetwork.id,
      networkPassphrase: dependencies.currentNetwork.networkPassphrase,
    });
  }
  if (isMuxedCandidate(input)) return unsupported('muxed-destination');
  if (looksSensitive(input)) return rejected('sensitive-input');
  if (!input.startsWith('web+stellar:')) return rejected('unrecognized-input');
  if (input.includes('#')) return rejected('malformed-uri');
  const match = /^web\+stellar:([^?&]+)(?:\?(.*))?$/.exec(input);
  if (!match) return rejected('malformed-uri');

  const operation = match[1];
  if (operation === 'tx') return unsupported('sep7-tx');
  if (operation !== 'pay') return unsupported('unsupported-operation');

  const entries = parseQuery(match[2] ?? '');
  if (!entries) return rejected('malformed-uri');

  const duplicate = firstDuplicateSupportedParameter(entries);
  if (duplicate !== undefined) return rejected('duplicate-parameter');

  const unsupportedFeature = classifyUnsupportedParameters(entries);
  if (unsupportedFeature !== undefined) return unsupported(unsupportedFeature);

  return parsePayIntent(dependencies, entries);
}

function parsePayIntent(
  dependencies: RequestUriDependencies,
  entries: ReadonlyMap<string, readonly string[]>,
): RequestParseResult {
  const destinationValue = firstValue(entries, 'destination');
  if (destinationValue === undefined || destinationValue.length === 0) return rejected('missing-destination');
  if (isMuxedCandidate(destinationValue)) return unsupported('muxed-destination');

  let destination: string;
  try {
    destination = validateClassicDestination(destinationValue, dependencies.isClassicAccountAddress);
  } catch {
    return rejected('invalid-destination');
  }

  const networkPassphrase = firstValue(entries, 'network_passphrase') ?? PUBLIC_NETWORK_PASSPHRASE;
  if (networkPassphrase !== dependencies.currentNetwork.networkPassphrase) return rejected('network-mismatch');

  const amountValue = firstValue(entries, 'amount');
  let amount: string | undefined;
  if (amountValue !== undefined) {
    try {
      amount = validateRequestAmount(amountValue);
    } catch {
      return rejected('invalid-amount');
    }
  }

  const assetResult = parseAsset(dependencies, entries);
  if (assetResult.status !== 'ok') return rejected('invalid-asset');

  const memoResult = parseMemo(entries);
  if (memoResult.status === 'unsupported') return unsupported('memo-return');
  if (memoResult.status === 'sensitive') return rejected('sensitive-input');
  if (memoResult.status === 'invalid') return rejected('invalid-memo');

  const messageValue = firstValue(entries, 'msg');
  if (messageValue !== undefined && looksSensitive(messageValue)) return rejected('sensitive-input');

  let message: string | undefined;
  try {
    message = validateRequestMessage(messageValue);
  } catch {
    return rejected('message-too-long');
  }
  return accepted({
    syntax: 'sep7-pay',
    destination,
    asset: assetResult.asset,
    ...(amount === undefined ? {} : { amount }),
    ...(memoResult.memo === undefined ? {} : { memo: memoResult.memo }),
    ...(message === undefined ? {} : { message }),
    networkId: dependencies.currentNetwork.id,
    networkPassphrase,
  });
}

function parseAsset(
  dependencies: RequestUriDependencies,
  entries: ReadonlyMap<string, readonly string[]>,
): Readonly<{ status: 'ok'; asset: StellarPaymentAsset }> | Readonly<{ status: 'invalid' }> {
  const code = firstValue(entries, 'asset_code');
  const issuer = firstValue(entries, 'asset_issuer');
  if ((code === undefined) !== (issuer === undefined)) return { status: 'invalid' };
  if (code === undefined || issuer === undefined) return { status: 'ok', asset: { kind: 'native' } };

  try {
    return {
      status: 'ok',
      asset: validateRequestAsset(dependencies, { kind: 'credit', code, issuer }),
    };
  } catch {
    return { status: 'invalid' };
  }
}
function parseMemo(
  entries: ReadonlyMap<string, readonly string[]>,
):
  | Readonly<{ status: 'ok'; memo?: StellarPaymentMemo }>
  | Readonly<{ status: 'invalid' }>
  | Readonly<{ status: 'sensitive' }>
  | Readonly<{ status: 'unsupported' }> {
  const value = firstValue(entries, 'memo');
  const type = firstValue(entries, 'memo_type');
  if ((value === undefined) !== (type === undefined)) return { status: 'invalid' };
  if (value === undefined || type === undefined) return { status: 'ok' };
  if (type === 'MEMO_RETURN') return { status: 'unsupported' };
  if (type === 'MEMO_TEXT' && looksSensitive(value)) return { status: 'sensitive' };

  try {
    switch (type) {
      case 'MEMO_TEXT':
        return { status: 'ok', memo: requireMemo(validatePaymentMemo({ type: 'text', value })) };
      case 'MEMO_ID':
        return { status: 'ok', memo: requireMemo(validatePaymentMemo({ type: 'id', value })) };
      case 'MEMO_HASH':
        return {
          status: 'ok',
          memo: requireMemo(validatePaymentMemo({ type: 'hash', value: decodeHashMemo(value) })),
        };
      default:
        return { status: 'invalid' };
    }
  } catch {
    return { status: 'invalid' };
  }
}
function validateRequestDestination(
  dependencies: Pick<RequestUriDependencies, 'isClassicAccountAddress'>,
  value: string,
): string {
  const candidate = value.trim();
  if (isMuxedCandidate(candidate)) throw new Error('request-muxed-destination-unsupported');
  try {
    return validateClassicDestination(candidate, dependencies.isClassicAccountAddress);
  } catch {
    throw new Error('request-invalid-destination');
  }
}

function validateRequestAmount(value: string): string {
  try {
    return validatePaymentAmount(value);
  } catch {
    throw new Error('request-invalid-amount');
  }
}

function validateRequestAsset(
  dependencies: Pick<RequestUriDependencies, 'isClassicAccountAddress'>,
  asset: StellarPaymentAsset,
): StellarPaymentAsset {
  try {
    return validatePaymentAsset(asset, dependencies.isClassicAccountAddress);
  } catch {
    throw new Error('request-invalid-asset');
  }
}
function validateRequestMemo(memo?: StellarPaymentMemo): StellarPaymentMemo | undefined {
  if (memo === undefined) return undefined;
  if (memo.type === 'text' && looksSensitive(memo.value)) {
    throw new Error('request-sensitive-input');
  }
  try {
    return requireMemo(validatePaymentMemo(memo));
  } catch {
    throw new Error('request-invalid-memo');
  }
}

function validateRequestMessage(message?: string): string | undefined {
  if (message === undefined) return undefined;
  if (looksSensitive(message)) throw new Error('request-sensitive-input');
  if (Array.from(message).length > 300) throw new Error('request-message-too-long');
  return message;
}

function requireMemo(memo?: StellarPaymentMemo): StellarPaymentMemo {
  if (memo === undefined) throw new Error('request-invalid-memo');
  return memo;
}

function memoToWire(memo: StellarPaymentMemo): Readonly<{ value: string; type: string }> {
  switch (memo.type) {
    case 'text':
      return { value: memo.value, type: 'MEMO_TEXT' };
    case 'id':
      return { value: memo.value, type: 'MEMO_ID' };
    case 'hash':
      return { value: encodeHashMemo(memo.value), type: 'MEMO_HASH' };
  }
}
function parseQuery(rawQuery: string): ReadonlyMap<string, readonly string[]> | undefined {
  const entries = new Map<string, string[]>();
  if (rawQuery.length === 0) return entries;

  for (const pair of rawQuery.split('&')) {
    if (pair.length === 0) return undefined;
    const separator = pair.indexOf('=');
    const rawKey = separator < 0 ? pair : pair.slice(0, separator);
    const rawValue = separator < 0 ? '' : pair.slice(separator + 1);

    let key: string;
    let value: string;
    try {
      key = decodeQueryComponent(rawKey);
      value = decodeQueryComponent(rawValue);
    } catch {
      return undefined;
    }

    const values = entries.get(key) ?? [];
    values.push(value);
    entries.set(key, values);
  }
  return entries;
}

function decodeQueryComponent(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}
function firstValue(entries: ReadonlyMap<string, readonly string[]>, key: string): string | undefined {
  return entries.get(key)?.[0];
}

function firstDuplicateSupportedParameter(entries: ReadonlyMap<string, readonly string[]>): string | undefined {
  for (const key of SUPPORTED_PARAMETERS) {
    if ((entries.get(key)?.length ?? 0) > 1) return key;
  }
  return undefined;
}

function classifyUnsupportedParameters(
  entries: ReadonlyMap<string, readonly string[]>,
): RequestUnsupportedFeature | undefined {
  if (entries.has('callback')) return 'callback';
  if (entries.has('origin_domain') || entries.has('signature')) return 'signed-origin';

  for (const key of entries.keys()) {
    if (!SUPPORTED_PARAMETERS.has(key)) return 'unsupported-parameter';
  }
  return undefined;
}

function isMuxedCandidate(value: string): boolean {
  return value.startsWith('M');
}

function looksSensitive(value: string): boolean {
  const candidate = value.trim();
  if (/(^|[^A-Z2-7])S[A-Z2-7]{55}($|[^A-Z2-7])/.test(candidate)) return true;
  const words = candidate.split(/\s+/);
  return [12, 15, 18, 21, 24].includes(words.length) && words.every(word => /^[A-Za-z]+$/.test(word));
}
function accepted(intent: RequestPaymentIntent): RequestParseResult {
  return {
    status: 'accepted',
    intent: Object.freeze(intent),
    diagnostics: Object.freeze({ outcome: 'accepted', category: 'payment-request' }),
  };
}

function rejected(reason: RequestRejectedReason): RequestParseResult {
  return {
    status: 'rejected',
    reason,
    diagnostics: Object.freeze({ outcome: 'rejected', category: reason }),
  };
}

function unsupported(feature: RequestUnsupportedFeature): RequestParseResult {
  return {
    status: 'unsupported',
    feature,
    diagnostics: Object.freeze({ outcome: 'unsupported', category: feature }),
  };
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeHashMemo(hex: string): string {
  const bytes: number[] = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  return encodeBase64(bytes);
}
function decodeHashMemo(value: string): string {
  const bytes = decodeBase64(value);
  if (bytes.length !== 32) throw new Error('request-memo-hash-invalid');
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function encodeBase64(bytes: readonly number[]): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const block = first * 65_536 + second * 256 + third;

    output += BASE64_ALPHABET[Math.floor(block / 262_144) % 64];
    output += BASE64_ALPHABET[Math.floor(block / 4_096) % 64];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[Math.floor(block / 64) % 64] : '=';
    output += index + 2 < bytes.length ? BASE64_ALPHABET[block % 64] : '=';
  }
  return output;
}

function decodeBase64(value: string): number[] {
  if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('request-memo-hash-invalid');
  }
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 4) {
    const chunk = value.slice(index, index + 4);
    const values = chunk.split('').map(character => (character === '=' ? 0 : BASE64_ALPHABET.indexOf(character)));
    if (values.some(item => item < 0)) throw new Error('request-memo-hash-invalid');

    const block = values[0] * 262_144 + values[1] * 4_096 + values[2] * 64 + values[3];
    bytes.push(Math.floor(block / 65_536) % 256);
    if (chunk[2] !== '=') bytes.push(Math.floor(block / 256) % 256);
    if (chunk[3] !== '=') bytes.push(block % 256);
  }

  if (encodeBase64(bytes) !== value) throw new Error('request-memo-hash-invalid');
  return bytes;
}
