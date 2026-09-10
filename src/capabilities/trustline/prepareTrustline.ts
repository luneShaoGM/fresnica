import type { AccountRecord } from '../account/types';
import type { NetworkContext } from '../network/types';
import type { StellarAccountState, StellarNativeBalance, StellarTrustlineBalance } from '../stellar/types';
import type { TrustlineGatewayPort } from './TrustlineGateway';
import {
  buildTrustlineReview,
  type TrustlineAuthorization,
  type TrustlineOperation,
  type TrustlineReview,
} from './buildTrustlineReview';

export const DEFAULT_TRUSTLINE_LIMIT = '708269837873.6765';
const MAX_INT64_STROOPS = 9_223_372_036_854_775_807n;

export type TrustlineAsset = Readonly<{ code: string; issuer: string }>;
export type TrustlineAction = TrustlineOperation;

export type PrepareTrustlineDependencies = Readonly<{
  gateway: TrustlineGatewayPort;
  network: NetworkContext;
}>;

export async function prepareTrustline(
  dependencies: PrepareTrustlineDependencies,
  account: AccountRecord,
  input: Readonly<{ action: TrustlineAction; asset: TrustlineAsset; limit?: string }>,
): Promise<TrustlineReview> {
  const validated = await validateTrustlineIntent(dependencies, account, input);
  return buildPreparedReview(
    dependencies,
    account,
    validated.operation,
    validated.asset,
    validated.limit,
    validated.baseFeeStroops,
    validated.expectedAuthorization,
    validated.expectedClawbackEnabled,
  );
}

export async function revalidateTrustlineReview(
  dependencies: PrepareTrustlineDependencies,
  account: AccountRecord,
  review: TrustlineReview,
): Promise<void> {
  const validated = await validateTrustlineIntent(dependencies, account, {
    action: review.operation,
    asset: review.asset,
    ...(review.limit === undefined ? {} : {limit: review.limit}),
  });

  if (review.operation !== validated.operation) {
    throw new Error('trustline-review-operation-state-changed');
  }
  if (review.operation !== 'remove') {
    if (review.limit === undefined || parseStroops(review.limit) !== parseStroops(validated.limit)) {
      throw new Error('trustline-review-limit-state-changed');
    }
  }
  if (
    review.expectedAuthorization !== undefined &&
    review.expectedAuthorization !== validated.expectedAuthorization
  ) {
    throw new Error('trustline-review-authorization-state-changed');
  }
  if (
    review.expectedClawbackEnabled !== undefined &&
    review.expectedClawbackEnabled !== validated.expectedClawbackEnabled
  ) {
    throw new Error('trustline-review-clawback-state-changed');
  }
}

type ValidatedTrustlineIntent = Readonly<{
  operation: TrustlineOperation;
  asset: TrustlineAsset;
  limit: string;
  baseFeeStroops: number;
  expectedAuthorization?: TrustlineAuthorization;
  expectedClawbackEnabled?: boolean;
}>;

async function validateTrustlineIntent(
  dependencies: PrepareTrustlineDependencies,
  account: AccountRecord,
  input: Readonly<{action: TrustlineAction; asset: TrustlineAsset; limit?: string}>,
): Promise<ValidatedTrustlineIntent> {
  assertClassicAccount(account, dependencies.network.id);
  const asset = validateTrustlineAsset(input.asset, address => dependencies.gateway.isClassicAccountAddress(address));
  if (asset.issuer === account.address) {
    throw new Error('trustline-issuer-cannot-trust-own-asset');
  }

  const sourceResult = await dependencies.gateway.loadAccountState(account.address);
  if (sourceResult.status !== 'active') {
    throw new Error('trustline-source-account-inactive');
  }
  const source = sourceResult.account;
  if (source.address !== account.address) {
    throw new Error('trustline-source-account-mismatch');
  }

  const existing = findTrustline(source, asset);
  const ledger = await dependencies.gateway.loadLedgerParameters();

  switch (input.action) {
    case 'add': {
      if (existing) {
        throw new Error('trustline-already-exists');
      }
      const limit = validatePositiveTrustlineLimit(input.limit ?? DEFAULT_TRUSTLINE_LIMIT);
      const issuer = await loadRequiredIssuer(dependencies.gateway, asset.issuer);
      ensureNativeCapacity(source, ledger.baseReserveStroops, ledger.baseFeeStroops, ledger.baseReserveStroops);
      return {
        operation: 'add',
        asset,
        limit,
        baseFeeStroops: ledger.baseFeeStroops,
        expectedAuthorization: issuer.flags.authRequired ? 'unauthorized' : 'full',
        expectedClawbackEnabled: issuer.flags.authClawbackEnabled,
      };
    }
    case 'set-limit': {
      if (!existing) {
        throw new Error('trustline-not-found');
      }
      const limit = validatePositiveTrustlineLimit(input.limit);
      const limitStroops = parseStroops(limit);
      const commitment = parseStroops(existing.balance) + parseStroops(existing.buyingLiabilities);
      if (limitStroops < commitment) {
        throw new Error('trustline-limit-below-commitment');
      }
      await loadRequiredIssuer(dependencies.gateway, asset.issuer);
      ensureNativeCapacity(source, ledger.baseReserveStroops, ledger.baseFeeStroops, 0);
      return {
        operation: 'set-limit',
        asset,
        limit,
        baseFeeStroops: ledger.baseFeeStroops,
        expectedAuthorization: authorizationFromTrustline(existing),
        expectedClawbackEnabled: existing.isClawbackEnabled,
      };
    }
    case 'remove': {
      if (!existing) {
        throw new Error('trustline-not-found');
      }
      if (
        parseStroops(existing.balance) !== 0n ||
        parseStroops(existing.buyingLiabilities) !== 0n ||
        parseStroops(existing.sellingLiabilities) !== 0n
      ) {
        throw new Error('trustline-remove-nonzero-balance-or-liabilities');
      }
      await ensureNotUsedByLiquidityPool(dependencies.gateway, source, asset);
      ensureNativeCapacity(source, ledger.baseReserveStroops, ledger.baseFeeStroops, 0);
      return {
        operation: 'remove',
        asset,
        limit: '0',
        baseFeeStroops: ledger.baseFeeStroops,
      };
    }
  }
}

async function loadRequiredIssuer(
  gateway: TrustlineGatewayPort,
  issuer: string,
): Promise<StellarAccountState> {
  const result = await gateway.loadAccountState(issuer);
  if (result.status !== 'active') {
    throw new Error('trustline-issuer-account-inactive');
  }
  if (result.account.address !== issuer) {
    throw new Error('trustline-issuer-account-mismatch');
  }
  return result.account;
}

function authorizationFromTrustline(trustline: StellarTrustlineBalance): TrustlineAuthorization {
  if (trustline.isAuthorized) {
    return 'full';
  }
  return trustline.isAuthorizedToMaintainLiabilities ? 'maintain-liabilities' : 'unauthorized';
}

function validatePositiveTrustlineLimit(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('invalid-trustline-limit');
  }
  const normalized = value.trim();
  let stroops: bigint;
  try {
    stroops = parseStroops(normalized);
  } catch {
    throw new Error('invalid-trustline-limit');
  }
  if (stroops <= 0n) {
    throw new Error('invalid-trustline-limit');
  }
  return normalized;
}

export function validateTrustlineAsset(
  asset: TrustlineAsset,
  isClassicAccountAddress: (address: string) => boolean,
): TrustlineAsset {
  const code = asset.code.trim();
  const issuer = asset.issuer.trim();
  if (!/^[A-Za-z0-9]{1,12}$/.test(code)) {
    throw new Error('invalid-trustline-asset-code');
  }
  if (!isClassicAccountAddress(issuer)) {
    throw new Error('invalid-trustline-asset-issuer');
  }
  return { code, issuer };
}

function assertClassicAccount(account: AccountRecord, networkId: string): void {
  if (account.networkId !== networkId) {
    throw new Error('trustline-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    throw new Error('trustline-requires-classic-account');
  }
}

function findTrustline(account: StellarAccountState, asset: TrustlineAsset): StellarTrustlineBalance | undefined {
  return account.balances.find(
    (balance): balance is StellarTrustlineBalance =>
      balance.kind === 'credit' && balance.code === asset.code && balance.issuer === asset.issuer,
  );
}

function nativeBalance(account: StellarAccountState): StellarNativeBalance | undefined {
  return account.balances.find((balance): balance is StellarNativeBalance => balance.kind === 'native');
}

function ensureNativeCapacity(
  account: StellarAccountState,
  baseReserveStroops: number,
  baseFeeStroops: number,
  additionalReserveStroops: number,
): void {
  if (
    !Number.isSafeInteger(baseReserveStroops) ||
    baseReserveStroops < 0 ||
    !Number.isSafeInteger(baseFeeStroops) ||
    baseFeeStroops < 0
  ) {
    throw new Error('invalid-ledger-reserve-or-fee');
  }

  const native = nativeBalance(account);
  const balance = native ? parseStroops(native.balance) : 0n;
  const sellingLiabilities = native ? parseStroops(native.sellingLiabilities) : 0n;
  const reserveUnits = Math.max(0, 2 + account.subentryCount + account.numSponsoring - account.numSponsored);
  const minimumBalance = BigInt(reserveUnits) * BigInt(baseReserveStroops);
  const free = balance - sellingLiabilities - minimumBalance;
  const required = BigInt(baseFeeStroops + additionalReserveStroops);
  if (free < required) {
    throw new Error('trustline-insufficient-xlm-for-reserve-and-fee');
  }
}

async function ensureNotUsedByLiquidityPool(
  gateway: TrustlineGatewayPort,
  account: StellarAccountState,
  asset: TrustlineAsset,
): Promise<void> {
  const identity = `${asset.code}:${asset.issuer}`;
  for (const balance of account.balances) {
    if (balance.kind !== 'liquidity-pool-share') {
      continue;
    }
    const pool = await gateway.loadLiquidityPool(balance.liquidityPoolId);
    if (pool.reserveAssets.includes(identity)) {
      throw new Error('trustline-remove-used-by-liquidity-pool');
    }
  }
}

async function buildPreparedReview(
  dependencies: PrepareTrustlineDependencies,
  account: AccountRecord,
  operation: TrustlineOperation,
  asset: TrustlineAsset,
  limit: string,
  baseFeeStroops: number,
  expectedAuthorization?: TrustlineAuthorization,
  expectedClawbackEnabled?: boolean,
): Promise<TrustlineReview> {
  const built = await dependencies.gateway.buildChangeTrust({
    source: account.address,
    code: asset.code,
    issuer: asset.issuer,
    limit,
    baseFee: String(baseFeeStroops),
  });
  if (built.source !== account.address || built.networkId !== account.networkId) {
    throw new Error('trustline-built-transaction-context-mismatch');
  }

  const review = buildTrustlineReview(dependencies, {
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: built.networkId,
    operation,
    ...(expectedAuthorization === undefined ? {} : { expectedAuthorization }),
    ...(expectedClawbackEnabled === undefined ? {} : { expectedClawbackEnabled }),
  });
  if (
    review.source !== account.address ||
    review.operation !== operation ||
    review.asset.code !== asset.code ||
    review.asset.issuer !== asset.issuer ||
    (operation !== 'remove' && (review.limit === undefined || parseStroops(review.limit) !== parseStroops(limit)))
  ) {
    throw new Error('trustline-review-context-mismatch');
  }
  return review;
}

function parseStroops(value: string): bigint {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(normalized);
  if (!match) {
    throw new Error('invalid-stellar-amount');
  }
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  const stroops = whole * 10_000_000n + fraction;
  if (stroops > MAX_INT64_STROOPS) {
    throw new Error('invalid-stellar-amount');
  }
  return stroops;
}
