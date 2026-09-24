import type { AccountRecord } from '../../capabilities/account/types';
import type { NetworkContext } from '../../capabilities/network/types';
import type { PaymentGatewayPort } from '../../capabilities/payment/PaymentGateway';
import type { RequestOutputPort, RequestShareResult } from '../../capabilities/request/RequestOutputPort';
import { buildRequestUri } from '../../capabilities/request/requestUri';
import type {
  StellarPaymentAsset,
  StellarPaymentMemo,
  StellarTrustlineBalance,
} from '../../capabilities/stellar/types';

export type RequestProductDependencies = Readonly<{
  gateway: Pick<PaymentGatewayPort, 'isClassicAccountAddress' | 'loadAccountState'>;
  network: NetworkContext;
  output: RequestOutputPort;
}>;

export type RequestDraft = Readonly<{
  amount?: string;
  asset: StellarPaymentAsset;
  memo?: StellarPaymentMemo;
  message?: string;
}>;

const NATIVE_ASSET: StellarPaymentAsset = Object.freeze({ kind: 'native' });

export function requestAvailableForAccount(account: AccountRecord, networkId: string): boolean {
  return account.networkId === networkId && account.identityKind === 'classic' && !account.hidden;
}

export async function loadRequestAssetChoices(
  dependencies: Pick<RequestProductDependencies, 'gateway' | 'network'>,
  account: AccountRecord,
): Promise<readonly StellarPaymentAsset[]> {
  assertRequestAccount(account, dependencies.network.id);
  const result = await dependencies.gateway.loadAccountState(account.address);

  if (result.status === 'inactive') {
    if (result.address !== account.address) {
      throw new Error('request-account-state-mismatch');
    }
    return [NATIVE_ASSET];
  }

  if (result.account.address !== account.address) {
    throw new Error('request-account-state-mismatch');
  }

  return [
    NATIVE_ASSET,
    ...result.account.balances
      .filter((balance): balance is StellarTrustlineBalance => balance.kind === 'credit')
      .filter(isReceivableTrustline)
      .map(balance => Object.freeze({ kind: 'credit' as const, code: balance.code, issuer: balance.issuer })),
  ];
}

export function buildRequestDraftUri(
  dependencies: Pick<RequestProductDependencies, 'gateway' | 'network'>,
  account: AccountRecord,
  draft: RequestDraft,
  receivableAssets: readonly StellarPaymentAsset[],
): string {
  assertRequestAccount(account, dependencies.network.id);
  if (!receivableAssets.some(asset => requestAssetKey(asset) === requestAssetKey(draft.asset))) {
    throw new Error('request-asset-not-receivable');
  }
  return buildRequestUri(
    { isClassicAccountAddress: address => dependencies.gateway.isClassicAccountAddress(address) },
    {
      destination: account.address,
      asset: draft.asset,
      ...(draft.amount === undefined ? {} : { amount: draft.amount }),
      ...(draft.memo === undefined ? {} : { memo: draft.memo }),
      ...(draft.message === undefined ? {} : { message: draft.message }),
      network: dependencies.network,
    },
  );
}

export async function copyRequestUri(
  dependencies: Pick<RequestProductDependencies, 'output'>,
  uri: string,
): Promise<void> {
  await dependencies.output.copyRequestUri(uri);
}

export async function shareRequestUri(
  dependencies: Pick<RequestProductDependencies, 'output'>,
  uri: string,
): Promise<RequestShareResult> {
  return dependencies.output.shareRequestUri(uri);
}

export function requestAssetKey(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'XLM' : `${asset.code}:${asset.issuer}`;
}

function assertRequestAccount(account: AccountRecord, networkId: string): void {
  if (!requestAvailableForAccount(account, networkId)) {
    throw new Error(account.networkId === networkId ? 'request-requires-classic-account' : 'request-network-mismatch');
  }
}

function isReceivableTrustline(trustline: StellarTrustlineBalance): boolean {
  if (!trustline.isAuthorized || trustline.limit === undefined) {
    return false;
  }

  try {
    const committed = parseStroops(trustline.balance) + parseStroops(trustline.buyingLiabilities);
    return parseStroops(trustline.limit) > committed;
  } catch {
    return false;
  }
}

function parseStroops(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value.trim());
  if (!match) {
    throw new Error('request-invalid-ledger-amount');
  }
  const fraction = (match[2] ?? '').padEnd(7, '0');
  return BigInt(match[1]) * 10_000_000n + BigInt(fraction || '0');
}
