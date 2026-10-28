// Clean-room Freighter request policy. Read calls stay permission-gated.
// SUBMIT_TRANSACTION opens an exact-XDR review and returns the signature to
// the page. Fresnica does not submit that transaction. Blob, auth-entry and
// token requests stay unsupported.
export type DappPublicSelection = Readonly<{
  accountId: string;
  address: string;
  networkId: string;
  networkPassphrase: string;
  networkUrl: string;
  revision: number;
}>;

type BridgeRequest = Readonly<{
  source: 'FREIGHTER_EXTERNAL_MSG_REQUEST';
  token?: string;
  messageId: string | number;
  type: string;
  accountToSign?: string;
  address?: string;
  networkPassphrase?: string;
  network?: string;
  transactionXdr?: string;
}>;

export type FreighterNetworkDetails = Readonly<{
  network: string;
  networkName: string;
  networkUrl: string;
  networkPassphrase: string;
  sorobanRpcUrl: string;
}>;

export type BridgeResponse = Readonly<{
  source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE';
  messagedId: string | number;
  publicKey?: string;
  isAllowed?: boolean;
  isConnected?: boolean;
  network?: string;
  networkDetails?: FreighterNetworkDetails;
  userInfo?: Readonly<{ publicKey: string }>;
  signedTransaction?: string;
  signerAddress?: string;
  error?: string;
}>;

export type BridgeDecision =
  | Readonly<{ kind: 'drop' }>
  | Readonly<{ kind: 'permission'; messageId: string | number; origin: string }>
  | Readonly<{
      kind: 'sign-transaction';
      messageId: string | number;
      origin: string;
      transactionXdrBase64: string;
      networkPassphrase: string;
      accountAddress: string;
    }>
  | Readonly<{ kind: 'respond'; response: BridgeResponse }>;

export type DappSignCompletion =
  | Readonly<{ status: 'declined' }>
  | Readonly<{ status: 'failed'; error: 'invalid-transaction' | 'unsupported-signer' }>
  | Readonly<{ status: 'signed'; signedTransaction: string; signerAddress: string }>;

const DROP: BridgeDecision = Object.freeze({ kind: 'drop' });
export const MAX_BRIDGE_MESSAGE_LENGTH = 262_144;
const MAX_TRANSACTION_XDR_LENGTH = 200_000;
const MAX_IDS_PER_DOCUMENT = 128;

const REQUEST_TYPES = new Set([
  'REQUEST_ACCESS',
  'REQUEST_PUBLIC_KEY',
  'SUBMIT_TOKEN',
  'SUBMIT_TRANSACTION',
  'SUBMIT_BLOB',
  'SUBMIT_AUTH_ENTRY',
  'REQUEST_NETWORK',
  'REQUEST_NETWORK_DETAILS',
  'REQUEST_CONNECTION_STATUS',
  'REQUEST_ALLOWED_STATUS',
  'SET_ALLOWED_STATUS',
  'REQUEST_USER_INFO',
]);
const COMMON_FIELDS = new Set(['accountToSign', 'address', 'networkPassphrase', 'token']);

function isMessageId(value: unknown): value is string | number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER;
  }
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

function isRequest(value: unknown): value is BridgeRequest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST' || !isMessageId(record.messageId)) return false;
  if (typeof record.type !== 'string' || !REQUEST_TYPES.has(record.type)) return false;
  for (const key of Object.keys(record)) {
    if (key === 'source' || key === 'messageId' || key === 'type') continue;
    const limit = fieldLimit(record.type, key);
    if (limit === undefined) return false;
    const field = record[key];
    if (typeof field !== 'string' || field.length === 0 || field.length > limit) return false;
    if (key === 'transactionXdr' && !isPaddedBase64(field)) return false;
  }
  if (record.type === 'SUBMIT_TRANSACTION' && typeof record.transactionXdr !== 'string') return false;
  return true;
}

function fieldLimit(type: string, key: string): number | undefined {
  if (COMMON_FIELDS.has(key)) return key === 'networkPassphrase' ? 256 : 128;
  if (type === 'SUBMIT_TRANSACTION' && key === 'transactionXdr') return MAX_TRANSACTION_XDR_LENGTH;
  if (type === 'SUBMIT_TRANSACTION' && key === 'network') return 64;
  return undefined;
}

function isPaddedBase64(value: string): boolean {
  return value.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function browserOrigin(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

function networkLabel(id: string): string | undefined {
  if (id === 'stellar-testnet') return 'TESTNET';
  if (id === 'stellar-mainnet') return 'PUBLIC';
  if (id === 'stellar-futurenet') return 'FUTURENET';
  return undefined;
}

function freighterNetwork(selection: DappPublicSelection): FreighterNetworkDetails | undefined {
  const network = networkLabel(selection.networkId);
  if (network === 'PUBLIC') {
    return {
      network,
      networkName: 'Main Net',
      networkUrl: selection.networkUrl,
      networkPassphrase: selection.networkPassphrase,
      sorobanRpcUrl: 'https://mainnet.sorobanrpc.com',
    };
  }
  if (network === 'TESTNET') {
    return {
      network,
      networkName: 'Test Net',
      networkUrl: selection.networkUrl,
      networkPassphrase: selection.networkPassphrase,
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    };
  }
  if (network === 'FUTURENET') {
    return {
      network,
      networkName: 'Future Net',
      networkUrl: selection.networkUrl,
      networkPassphrase: selection.networkPassphrase,
      sorobanRpcUrl: 'https://rpc-futurenet.stellar.org',
    };
  }
  return undefined;
}

export function createFreighterSession(
  input: Readonly<{
    origin: string;
    token: string;
    initial: DappPublicSelection;
    current: () => DappPublicSelection | undefined;
    persistedAllowed?: () => boolean;
  }>,
) {
  const initial = Object.freeze({ ...input.initial });
  const used = new Set<string>();
  let documentOrigin = input.origin;
  let allowed = false;
  let pending: BridgeRequest | undefined;
  let pendingSign:
    Readonly<{ messageId: string | number; transactionXdrBase64: string; accountAddress: string }> | undefined;
  let closed = false;

  function remembered(): boolean {
    try {
      return input.persistedAllowed?.() === true;
    } catch {
      return false;
    }
  }

  function connected(): boolean {
    return allowed || remembered();
  }

  function live(): boolean {
    try {
      const selected = input.current();
      return (
        selected !== undefined &&
        selected.accountId === initial.accountId &&
        selected.address === initial.address &&
        selected.networkId === initial.networkId &&
        selected.networkPassphrase === initial.networkPassphrase &&
        selected.networkUrl === initial.networkUrl &&
        selected.revision === initial.revision
      );
    } catch {
      return false;
    }
  }

  function response(request: BridgeRequest, fields: Omit<BridgeResponse, 'source' | 'messagedId'>): BridgeDecision {
    const reply: BridgeResponse = {
      source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
      messagedId: request.messageId,
      ...fields,
    };
    return { kind: 'respond', response: reply };
  }

  function receive(raw: string, messageUrl: string): BridgeDecision {
    if (
      closed ||
      raw.length === 0 ||
      raw.length > MAX_BRIDGE_MESSAGE_LENGTH ||
      browserOrigin(messageUrl) !== documentOrigin
    )
      return DROP;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return DROP;
    }
    if (!isRequest(json) || (json.token !== undefined && json.token !== input.token)) return DROP;
    const id = typeof json.messageId + ':' + String(json.messageId);
    if (used.has(id) || used.size >= MAX_IDS_PER_DOCUMENT) return DROP;
    used.add(id);
    if (!live()) return response(json, { error: 'session-stale' });

    switch (json.type) {
      case 'REQUEST_ALLOWED_STATUS':
        return response(json, { isAllowed: connected() });
      case 'REQUEST_CONNECTION_STATUS':
        // Presence of the selected account, independent of this origin's grant.
        return response(json, { isConnected: true });
      case 'REQUEST_ACCESS':
      case 'SET_ALLOWED_STATUS':
        if (connected()) {
          return response(json, json.type === 'REQUEST_ACCESS' ? { publicKey: initial.address } : { isAllowed: true });
        }
        if (pending) return response(json, { error: 'permission-pending' });
        pending = json;
        return { kind: 'permission', messageId: json.messageId, origin: documentOrigin };
      // No disclosed account/network context without explicit origin/account/
      // network-scoped approval. Opening the browser is not approval.
      case 'REQUEST_PUBLIC_KEY':
      case 'REQUEST_NETWORK':
      case 'REQUEST_NETWORK_DETAILS':
      case 'REQUEST_USER_INFO': {
        if (!connected()) return response(json, { error: 'not-authorized' });
        if (json.type === 'REQUEST_PUBLIC_KEY') return response(json, { publicKey: initial.address });
        if (json.type === 'REQUEST_USER_INFO') {
          return response(json, { userInfo: { publicKey: initial.address } });
        }
        const details = freighterNetwork(initial);
        if (!details) return response(json, { error: 'unsupported-network' });
        if (json.type === 'REQUEST_NETWORK') return response(json, { network: details.network });
        return response(json, { networkDetails: details });
      }
      case 'SUBMIT_TRANSACTION':
        return reviewTransaction(json);
      default:
        return response(json, { error: 'unsupported' });
    }
  }

  function reviewTransaction(request: BridgeRequest): BridgeDecision {
    if (!connected()) return response(request, { error: 'not-authorized' });
    if (pendingSign) return response(request, { error: 'sign-pending' });
    const details = freighterNetwork(initial);
    if (!details) return response(request, { error: 'unsupported-network' });
    if (request.network !== undefined && request.network !== details.network) {
      return response(request, { error: 'wrong-network' });
    }
    if (request.networkPassphrase !== undefined && request.networkPassphrase !== initial.networkPassphrase) {
      return response(request, { error: 'wrong-network' });
    }
    if (
      request.accountToSign !== undefined &&
      request.address !== undefined &&
      request.accountToSign !== request.address
    ) {
      return response(request, { error: 'wrong-account' });
    }
    const requestedAccount = request.accountToSign ?? request.address;
    if (requestedAccount !== undefined && requestedAccount !== initial.address) {
      return response(request, { error: 'wrong-account' });
    }
    const transactionXdrBase64 = request.transactionXdr;
    if (transactionXdrBase64 === undefined) return DROP;
    pendingSign = {
      messageId: request.messageId,
      transactionXdrBase64,
      accountAddress: initial.address,
    };
    return {
      kind: 'sign-transaction',
      messageId: request.messageId,
      origin: documentOrigin,
      transactionXdrBase64,
      networkPassphrase: initial.networkPassphrase,
      accountAddress: initial.address,
    };
  }

  function finishSign(result: DappSignCompletion): BridgeResponse | null {
    const request = pendingSign;
    pendingSign = undefined;
    if (closed || request === undefined || !live()) return null;
    if (result.status === 'declined') {
      return { source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: request.messageId, error: 'user-declined' };
    }
    if (result.status === 'failed') {
      return { source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: request.messageId, error: result.error };
    }
    if (
      result.signerAddress !== request.accountAddress ||
      result.signedTransaction.length === 0 ||
      result.signedTransaction === request.transactionXdrBase64
    ) {
      return {
        source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messagedId: request.messageId,
        error: 'invalid-transaction',
      };
    }
    return {
      source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
      messagedId: request.messageId,
      signedTransaction: result.signedTransaction,
      signerAddress: result.signerAddress,
    };
  }

  function resolvePermission(approved: boolean): BridgeDecision | null {
    const request = pending;
    pending = undefined;
    if (closed || request === undefined || !live()) return null;
    if (!approved) return response(request, { error: 'user-declined' });
    allowed = true;
    return response(request, request.type === 'REQUEST_ACCESS' ? { publicKey: initial.address } : { isAllowed: true });
  }

  function reset(): void {
    // Same-origin navigation starts a new document, so message ids can be reused.
    // An allow-once grant stays until the browser session is revoked.
    pending = undefined;
    pendingSign = undefined;
    used.clear();
  }

  function activateDocument(origin: string): void {
    if (closed || origin.length === 0) return;
    // Allow-once belongs to the document origin that requested it.
    if (origin !== documentOrigin) {
      documentOrigin = origin;
      allowed = false;
    }
    reset();
  }

  function revoke(): void {
    reset();
    closed = true;
  }

  return Object.freeze({
    receive,
    resolvePermission,
    finishSign,
    reset,
    activateDocument,
    revoke,
    isLive: () => !closed && live(),
  });
}
