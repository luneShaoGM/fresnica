import type { AccountRecord } from '../account/types';
import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { NetworkContext } from '../network/types';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';
import { createTransactionIntentIdentity, type PendingSubmissionDependencies } from '../transaction/pendingSubmission';
import { assertReviewedTransactionFresh } from '../transaction/assertReviewedTransactionFresh';
import { submitReviewedTransaction } from '../transaction/submitReviewedTransaction';
import {
  formatContractBalance,
  validContractBaseUnits,
  type ContractAssets,
  type ContractTokenReadPort,
} from './contractAssets';

export const SOROBAN_TRANSFER_INTENT = 'soroban-transfer';
export type ContractTransferRequest = Readonly<{ contractId: string; destination: string; amount: string }>;
export type ContractTransferOperation = Readonly<{
  contractId: string;
  source: string;
  destination: string;
  baseUnits: string;
}>;
export type BuiltContractTransfer = ReviewedTransaction & Readonly<{ hash: string; resourceFee: string }>;
export type ContractTransferReview = BuiltContractTransfer &
  ContractTransferOperation &
  Readonly<{
    accountId: string;
    amount: string;
    decimals: number;
  }>;
export interface ContractTransferGateway extends TransactionGatewayPort {
  readonly network: NetworkContext;
  prepare(operation: ContractTransferOperation): Promise<BuiltContractTransfer>;
  verifySigned(review: BuiltContractTransfer, signedXdr: string, signerPublicKey: string): void;
}
export function parseContractTransferAmount(input: string, decimals: number): string {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 38 ||
    input.length > 80 ||
    !/^(0|[1-9]\d*)(\.\d+)?$/.test(input)
  )
    throw new Error('contract-transfer-amount');
  const [whole, fraction = ''] = input.split('.');
  if (fraction.length > decimals) throw new Error('contract-transfer-amount');
  const value = BigInt(whole + fraction.padEnd(decimals, '0'));
  const baseUnits = String(value);
  if (value <= 0n || !validContractBaseUnits(baseUnits)) throw new Error('contract-transfer-amount');
  return baseUnits;
}

export type ContractTransfers = ReturnType<typeof createContractTransfers>;
export function createContractTransfers(
  deps: Readonly<{
    repository: Pick<AccountSignerRepository, 'getAccount' | 'listSignersForAccount'>;
    assets: Pick<ContractAssets, 'list' | 'markBalanceStale'>;
    reader: ContractTokenReadPort;
    gateway: ContractTransferGateway;
    sdk: FresnicaSdkPort;
    recovery: PendingSubmissionDependencies;
    now: () => number;
    monotonic: () => number;
    authorizationEpoch: () => number | undefined;
  }>,
) {
  const { network } = deps.gateway;
  if (deps.reader.network.id !== network.id || deps.reader.network.networkPassphrase !== network.networkPassphrase)
    throw new Error('contract-transfer-network');
  const issued = new WeakMap<
    ContractTransferReview,
    {
      account: AccountRecord;
      signerId: string;
      signerKey: string;
      revision?: string;
      envelopeJson: string;
      epoch: number;
      preparedAt: number;
      monotonicDeadline: number;
    }
  >();
  const running = new WeakSet<ContractTransferReview>();
  function accountSigner(account: AccountRecord) {
    const current = deps.repository.getAccount(account.id);
    if (
      !current ||
      current.hidden ||
      account.hidden ||
      current.identityKind !== 'classic' ||
      account.identityKind !== 'classic' ||
      current.address !== account.address ||
      current.networkId !== network.id ||
      account.networkId !== network.id
    )
      throw new Error('contract-transfer-account');
    const signers = deps.repository.listSignersForAccount(account.id);
    const signer = signers[0];
    if (
      signers.length !== 1 ||
      !signer ||
      signer.kind !== 'protected-software' ||
      !signer.envelopeJson ||
      signer.backupState === 'pending'
    )
      throw new Error('contract-transfer-signer');
    return signer;
  }
  return Object.freeze({
    network,
    canPrepare(account: AccountRecord) {
      try {
        accountSigner(account);
        return deps.authorizationEpoch() !== undefined;
      } catch {
        return false;
      }
    },
    async prepare(
      account: AccountRecord,
      request: ContractTransferRequest,
      signal: AbortSignal,
      isCurrent: () => boolean,
    ) {
      const signer = accountSigner(account);
      const epoch = deps.authorizationEpoch();
      const startedAt = deps.now();
      const check = () => {
        if (
          signal.aborted ||
          !isCurrent() ||
          epoch === undefined ||
          deps.authorizationEpoch() !== epoch ||
          deps.now() < startedAt
        )
          throw new Error('contract-transfer-retired');
        const fresh = accountSigner(account);
        if (
          fresh.id !== signer.id ||
          fresh.publicKey !== signer.publicKey ||
          fresh.envelopeRevision !== signer.envelopeRevision ||
          fresh.envelopeJson !== signer.envelopeJson
        )
          throw new Error('contract-transfer-retired');
      };
      check();
      const contractId = request.contractId.trim();
      const destination = request.destination.trim();
      if (
        !deps.reader.isContractId(contractId) ||
        !deps.reader.isClassicAddress(destination) ||
        destination === account.address
      )
        throw new Error('contract-transfer-destination');
      const tracked = deps.assets.list(account).find(row => row.contractId === contractId);
      if (!tracked) throw new Error('contract-transfer-not-tracked');
      const token = await deps.reader.readToken(contractId, account.address, signal);
      check();
      if (
        !token.balance ||
        token.metadata.decimals !== tracked.metadata.decimals ||
        !validContractBaseUnits(token.balance.baseUnits)
      )
        throw new Error('contract-transfer-balance');
      const baseUnits = parseContractTransferAmount(request.amount.trim(), token.metadata.decimals);
      if (BigInt(baseUnits) > BigInt(token.balance.baseUnits)) throw new Error('contract-transfer-balance');
      const operation = Object.freeze({ contractId, source: account.address, destination, baseUnits });
      const built = await deps.gateway.prepare(operation);
      check();
      if (
        built.source !== account.address ||
        built.networkId !== network.id ||
        !/^[0-9a-f]{64}$/.test(built.hash) ||
        !built.transactionXdrBase64 ||
        built.expiresAtUnixSeconds === undefined
      )
        throw new Error('contract-transfer-review');
      const preparedAt = deps.now();
      assertReviewedTransactionFresh(built, Math.floor(preparedAt / 1000));
      const lifetime = built.expiresAtUnixSeconds * 1000 - preparedAt;
      const monotonicDeadline = deps.monotonic() + lifetime;
      if (lifetime <= 0 || lifetime > 120_000 || !Number.isFinite(monotonicDeadline))
        throw new Error('contract-transfer-review');
      const review: ContractTransferReview = Object.freeze({
        ...built,
        ...operation,
        accountId: account.id,
        decimals: token.metadata.decimals,
        amount: formatContractBalance(baseUnits, token.metadata.decimals)!,
      });
      issued.set(review, {
        account: { ...account },
        signerId: signer.id,
        signerKey: signer.publicKey,
        revision: signer.envelopeRevision,
        envelopeJson: signer.envelopeJson!,
        epoch: epoch!,
        preparedAt,
        monotonicDeadline,
      });
      return review;
    },
    async submit(review: ContractTransferReview, appPassphrase: string | undefined, isCurrent: () => boolean) {
      const proof = issued.get(review);
      if (!proof || running.has(review)) throw new Error('contract-transfer-review');
      const signer = accountSigner(proof.account);
      const current = () => {
        try {
          const fresh = accountSigner(proof.account);
          return (
            isCurrent() &&
            deps.authorizationEpoch() === proof.epoch &&
            deps.now() >= proof.preparedAt &&
            deps.now() < review.expiresAtUnixSeconds! * 1000 &&
            deps.monotonic() < proof.monotonicDeadline &&
            fresh.id === proof.signerId &&
            fresh.publicKey === proof.signerKey &&
            fresh.envelopeRevision === proof.revision &&
            fresh.envelopeJson === proof.envelopeJson &&
            deps.assets.list(proof.account).some(row => row.contractId === review.contractId)
          );
        } catch {
          return false;
        }
      };
      if (!current() || review.source !== proof.account.address || review.networkId !== network.id)
        throw new Error('contract-transfer-retired');
      const gateway: TransactionGatewayPort = {
        loadAccountAuthorization: address => deps.gateway.loadAccountAuthorization(address),
        transactionHash(signed) {
          deps.gateway.verifySigned(review, signed, signer.publicKey);
          return deps.gateway.transactionHash(signed);
        },
        loadTransactionOutcome: hash => deps.gateway.loadTransactionOutcome(hash),
        submitTransaction: signed => {
          // This callback runs only after the shared pipeline has persisted
          // the original hash. Retire old display reads, not the submission.
          try {
            deps.assets.markBalanceStale(proof.account, review.contractId);
          } catch {
            /* display-only */
          }
          return deps.gateway.submitTransaction(signed);
        },
      };
      running.add(review);
      try {
        return await submitReviewedTransaction({
          gateway,
          sdk: deps.sdk,
          review,
          accountId: proof.account.id,
          signer,
          recovery: deps.recovery,
          thresholdLevel: 'medium',
          appPassphrase,
          networkPassphrase: network.networkPassphrase,
          isCurrent: current,
          intent: createTransactionIntentIdentity(SOROBAN_TRANSFER_INTENT, [
            review.contractId,
            review.destination,
            review.baseUnits,
          ]),
        });
      } finally {
        running.delete(review);
      }
    },
    outcome: (hash: string) => deps.recovery.repository.get(network.id, hash)?.state,
  });
}
