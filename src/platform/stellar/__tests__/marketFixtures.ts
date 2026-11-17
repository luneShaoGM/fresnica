import {
  Account,
  Asset,
  Horizon,
  Keypair,
  LiquidityPoolAsset,
  Networks,
  Transaction,
  getLiquidityPoolId,
} from '@stellar/stellar-sdk/axios';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { StellarAccountState } from '../../../capabilities/stellar/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import type { ExitRequest, OfferRequest } from '../../../capabilities/markets/types';
import { StellarMarketGateway } from '../StellarMarketGateway';
import type { StellarGateway } from '../StellarGateway';
import { InMemoryAccountSignerRepository } from '../../persistence/memory/InMemoryAccountSignerRepository';
import { InMemoryPendingSubmissionRepository } from '../../persistence/memory/InMemoryPendingSubmissionRepository';
import type { TransactionSubmissionResult } from '../../../capabilities/transaction/submission';
import { createMarkets } from '../../../capabilities/markets/createMarkets';

const testKey = Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(23));
export const address = testKey.publicKey();
export const issuer = Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(24)).publicKey();
export const network = { id: 'stellar-testnet', networkPassphrase: Networks.TESTNET };
export const native = { kind: 'native' as const };
export const usd = { kind: 'credit' as const, code: 'usd', issuer };
const lp = new LiquidityPoolAsset(Asset.native(), new Asset('usd', issuer), 30);
export const poolId = Array.from(getLiquidityPoolId('constant_product', lp.getLiquidityPoolParameters()))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');
export const pool = {
  id: poolId,
  assetA: native,
  assetB: usd,
  reserveA: '100',
  reserveB: '200',
  totalShares: '50',
  protocolFee: 30,
  ledger: 100,
};
export const rawPool = {
  id: poolId,
  type: 'constant_product',
  reserves: [
    { asset: 'native', amount: '100' },
    { asset: 'usd:' + issuer, amount: '200' },
  ],
  total_shares: '50',
  fee_bp: 30,
  last_modified_ledger: 100,
};
export const state: StellarAccountState = {
  address,
  subentryCount: 3,
  numSponsored: 0,
  numSponsoring: 0,
  flags: { authRequired: false, authClawbackEnabled: false },
  balances: [
    { kind: 'native', balance: '1000', buyingLiabilities: '0', sellingLiabilities: '10' },
    {
      kind: 'credit',
      code: 'usd',
      issuer,
      balance: '1000',
      limit: '10000',
      buyingLiabilities: '5',
      sellingLiabilities: '0',
      isAuthorized: true,
      isAuthorizedToMaintainLiabilities: true,
      isClawbackEnabled: false,
    },
    { kind: 'liquidity-pool-share', balance: '5', liquidityPoolId: poolId },
  ],
};
export const account: AccountRecord = {
  id: 'source',
  address,
  networkId: network.id,
  identityKind: 'classic',
  hidden: false,
  label: 'Test',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
export const exit: ExitRequest = { kind: 'exit', poolId, mode: 'all', slippageBps: 50, close: false };
export const createOffer: OfferRequest = {
  kind: 'offer',
  action: 'create',
  base: native,
  counter: usd,
  side: 'sell',
  amount: '1',
  price: '2',
};
export const rawOffer = {
  id: '12',
  seller: address,
  selling: { asset_type: 'native' },
  buying: { asset_type: 'credit_alphanum4', asset_code: 'usd', asset_issuer: issuer },
  amount: '10.0000000',
  price_r: { n: 1, d: 2 },
};
export function fixture() {
  const repository = new InMemoryAccountSignerRepository();
  repository.createAccount(account);
  const signer: SignerRecord = {
    id: 'signer',
    kind: 'protected-software',
    publicKey: address,
    envelopeJson: 'test-fixture',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  repository.createSigner(signer);
  repository.attachSigner(account.id, signer.id, new Date(0));
  const pending = new InMemoryPendingSubmissionRepository();
  const recovery = { repository: pending, readInvalidation: { invalidate: jest.fn() }, now: () => new Date() };
  const base = {
    network,
    loadAccountState: jest.fn(async () => ({ status: 'active' as const, account: state })),
    loadLedgerParameters: jest.fn(async () => ({ baseFeeStroops: 100, baseReserveStroops: 5000000 })),
    loadAccountAuthorization: jest.fn(async () => ({
      address,
      thresholds: { low: 1, medium: 1, high: 1 },
      signers: [{ kind: 'ed25519' as const, publicKey: address, weight: 1 }],
    })),
    transactionHash: (value: string) =>
      Array.from(new Transaction(value, Networks.TESTNET).hash())
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(''),
    submitTransaction: jest.fn(async (value: string): Promise<TransactionSubmissionResult> => ({
      status: 'accepted' as const,
      hash: Array.from(new Transaction(value, Networks.TESTNET).hash())
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(''),
      ledger: 101,
    })),
    loadTransactionOutcome: jest.fn(async (hash: string) => ({
      status: 'confirmed' as const,
      transactionHash: hash,
      ledger: 101,
    })),
  };
  const read = jest.fn(async (path: string): Promise<unknown> =>
    path.startsWith('/liquidity_pools/')
      ? rawPool
      : path.startsWith('/offers/')
        ? rawOffer
        : { _embedded: { records: [rawOffer] } },
  );
  const server = {
    loadAccount: jest.fn(
      async () => new Account(address, '100') as unknown as Awaited<ReturnType<Horizon.Server['loadAccount']>>,
    ),
  };
  const gateway = new StellarMarketGateway(
    network,
    base as unknown as StellarGateway,
    read,
    'https://horizon-testnet.stellar.org',
    server,
  );
  const sign = jest.fn(async (input: { transactionXdrBase64: string; appPassphrase: string }) => {
    if (input.appPassphrase !== 'test-passphrase') throw new Error('invalid-passcode');
    const tx = new Transaction(input.transactionXdrBase64, Networks.TESTNET);
    tx.sign(testKey);
    return tx.toXdr();
  });
  const sdk = { signWithPassphrase: sign } as unknown as FresnicaSdkPort;
  const clock = { now: Date.now(), monotonic: 0 };
  const dependencies = {
    network,
    gateway,
    repository,
    sdk,
    recovery,
    now: () => clock.now,
    monotonic: () => clock.monotonic,
  };
  return {
    product: createMarkets(dependencies),
    dependencies,
    base,
    gateway,
    repository,
    pending,
    recovery,
    read,
    sign,
    clock,
    server,
  };
}
