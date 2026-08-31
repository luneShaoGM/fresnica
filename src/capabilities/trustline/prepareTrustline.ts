import {StrKey} from '@stellar/stellar-sdk';

import {APP_CONFIG} from '../../app/config/appConfig';
import type {AccountRecord} from '../account/types';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';
import type {
  StellarAccountState,
  StellarNativeBalance,
  StellarTrustlineBalance,
} from '../../platform/stellar/types';
import {
  buildTrustlineReview,
  type TrustlineAuthorization,
  type TrustlineReview,
} from './buildTrustlineReview';

export const DEFAULT_TRUSTLINE_LIMIT = '708269837873.6765';
const MAX_INT64_STROOPS = 9_223_372_036_854_775_807n;

export type TrustlineAsset = Readonly<{code: string; issuer: string}>;
export type TrustlineAction = 'add' | 'remove';

export type PrepareTrustlineDependencies = Readonly<{
  gateway: StellarGateway;
}>;

export async function prepareTrustline(
  dependencies: PrepareTrustlineDependencies,
  account: AccountRecord,
  input: Readonly<{action: TrustlineAction; asset: TrustlineAsset}>,
): Promise<TrustlineReview> {
  assertClassicAccount(account);
  const asset = validateTrustlineAsset(input.asset);
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

  if (input.action === 'add') {
    if (existing) {
      throw new Error('trustline-already-exists');
    }

    const issuerResult = await dependencies.gateway.loadAccountState(asset.issuer);
    if (issuerResult.status !== 'active') {
      throw new Error('trustline-issuer-account-inactive');
    }
    if (issuerResult.account.address !== asset.issuer) {
      throw new Error('trustline-issuer-account-mismatch');
    }

    ensureNativeCapacity(
      source,
      ledger.baseReserveStroops,
      ledger.baseFeeStroops,
      ledger.baseReserveStroops,
    );

    const expectedAuthorization: TrustlineAuthorization = issuerResult.account.flags.authRequired
      ? 'unauthorized'
      : 'full';
    return buildPreparedReview(
      dependencies.gateway,
      account,
      asset,
      DEFAULT_TRUSTLINE_LIMIT,
      ledger.baseFeeStroops,
      expectedAuthorization,
      issuerResult.account.flags.authClawbackEnabled,
    );
  }

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

  return buildPreparedReview(
    dependencies.gateway,
    account,
    asset,
    '0',
    ledger.baseFeeStroops,
  );
}

export function validateTrustlineAsset(asset: TrustlineAsset): TrustlineAsset {
  const code = asset.code.trim();
  const issuer = asset.issuer.trim();
  if (!/^[A-Za-z0-9]{1,12}$/.test(code)) {
    throw new Error('invalid-trustline-asset-code');
  }
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error('invalid-trustline-asset-issuer');
  }
  return {code, issuer};
}

function assertClassicAccount(account: AccountRecord): void {
  if (account.networkId !== APP_CONFIG.network.id) {
    throw new Error('trustline-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    throw new Error('trustline-requires-classic-account');
  }
}

function findTrustline(
  account: StellarAccountState,
  asset: TrustlineAsset,
): StellarTrustlineBalance | undefined {
  return account.balances.find(
    (balance): balance is StellarTrustlineBalance =>
      balance.kind === 'credit' &&
      balance.code === asset.code &&
      balance.issuer === asset.issuer,
  );
}

function nativeBalance(account: StellarAccountState): StellarNativeBalance | undefined {
  return account.balances.find(
    (balance): balance is StellarNativeBalance => balance.kind === 'native',
  );
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
  const reserveUnits = Math.max(
    0,
    2 + account.subentryCount + account.numSponsoring - account.numSponsored,
  );
  const minimumBalance = BigInt(reserveUnits) * BigInt(baseReserveStroops);
  const free = balance - sellingLiabilities - minimumBalance;
  const required = BigInt(baseFeeStroops + additionalReserveStroops);
  if (free < required) {
    throw new Error('trustline-insufficient-xlm-for-reserve-and-fee');
  }
}

async function ensureNotUsedByLiquidityPool(
  gateway: StellarGateway,
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
  gateway: StellarGateway,
  account: AccountRecord,
  asset: TrustlineAsset,
  limit: string,
  baseFeeStroops: number,
  expectedAuthorization?: TrustlineAuthorization,
  expectedClawbackEnabled?: boolean,
): Promise<TrustlineReview> {
  const built = await gateway.buildChangeTrust({
    source: account.address,
    code: asset.code,
    issuer: asset.issuer,
    limit,
    baseFee: String(baseFeeStroops),
  });
  if (built.source !== account.address || built.networkId !== account.networkId) {
    throw new Error('trustline-built-transaction-context-mismatch');
  }

  const review = buildTrustlineReview({
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: built.networkId,
    ...(expectedAuthorization === undefined ? {} : {expectedAuthorization}),
    ...(expectedClawbackEnabled === undefined ? {} : {expectedClawbackEnabled}),
  });
  if (
    review.source !== account.address ||
    review.asset.code !== asset.code ||
    review.asset.issuer !== asset.issuer
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
