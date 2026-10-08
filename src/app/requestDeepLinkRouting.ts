import type { AccountRecord } from '../capabilities/account/types';
import {
  assertPaymentSourceCanSendAsset,
  type PreparePaymentDependencies,
} from '../capabilities/payment/preparePayment';
import type { RequestPaymentIntent, RequestParseResult } from '../capabilities/request/requestUri';
import { parseRequestInput } from '../capabilities/request/requestUri';
import type { RequestProductDependencies } from '../features/request/requestProductFlow';
import { resolvePreferredVisibleAccountId, resolveVisibleAccount } from './navigation/accountSelection';

export type RequestDeepLinkParsed = Readonly<{
  kind: 'parsed';
  result: RequestParseResult;
  diagnostics: Readonly<{
    carrier: 'deep-link';
    outcome: RequestParseResult['diagnostics']['outcome'];
    category: RequestParseResult['diagnostics']['category'];
  }>;
}>;

export type RequestDeepLinkResolved =
  | Readonly<{ kind: 'ready'; intent: RequestPaymentIntent; accountId: string }>
  | Readonly<{
      kind: 'blocked';
      reason: 'invalid' | 'unsupported' | 'network-mismatch' | 'no-account' | 'account-ineligible';
    }>;

export function parseRequestDeepLink(
  dependencies: Pick<RequestProductDependencies, 'gateway' | 'network'>,
  rawUrl: string,
): RequestDeepLinkParsed {
  const result = parseRequestInput(
    {
      currentNetwork: dependencies.network,
      isClassicAccountAddress: address => dependencies.gateway.isClassicAccountAddress(address),
    },
    rawUrl,
  );

  return Object.freeze({
    kind: 'parsed',
    result,
    diagnostics: Object.freeze({
      carrier: 'deep-link',
      outcome: result.diagnostics.outcome,
      category: result.diagnostics.category,
    }),
  });
}

export async function resolveRequestDeepLink(
  dependencies: Pick<PreparePaymentDependencies, 'gateway' | 'network'>,
  parsed: RequestDeepLinkParsed,
  accounts: readonly AccountRecord[],
  defaultAccountId: string | undefined,
  isWatchOnly: (accountId: string) => boolean,
): Promise<RequestDeepLinkResolved> {
  if (parsed.result.status === 'unsupported') {
    return { kind: 'blocked', reason: 'unsupported' };
  }
  if (parsed.result.status === 'rejected') {
    return {
      kind: 'blocked',
      reason: parsed.result.reason === 'network-mismatch' ? 'network-mismatch' : 'invalid',
    };
  }

  const accountId = resolvePreferredVisibleAccountId(accounts, dependencies.network.id, defaultAccountId);
  if (accountId === undefined) {
    return { kind: 'blocked', reason: 'no-account' };
  }

  const account = resolveVisibleAccount(accounts, accountId);
  if (account.networkId !== dependencies.network.id || account.identityKind !== 'classic' || isWatchOnly(account.id)) {
    return { kind: 'blocked', reason: 'account-ineligible' };
  }

  if (parsed.result.intent.asset.kind === 'credit') {
    try {
      await assertPaymentSourceCanSendAsset(dependencies, account, {
        asset: parsed.result.intent.asset,
        ...(parsed.result.intent.amount === undefined ? {} : { amount: parsed.result.intent.amount }),
      });
    } catch {
      return { kind: 'blocked', reason: 'account-ineligible' };
    }
  }

  return { kind: 'ready', intent: parsed.result.intent, accountId: account.id };
}
