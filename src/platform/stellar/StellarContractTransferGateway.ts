import {
  Account,
  Address,
  Asset,
  Keypair,
  Operation,
  rpc,
  StrKey,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import type {
  ContractTransferGateway,
  ContractTransferOperation,
  BuiltContractTransfer,
} from '@capabilities/assets/contractTransfer';
import type { NetworkContext } from '@capabilities/network/types';
import { NETWORKS } from '@capabilities/network/networkPreferences';
import { SOROBAN_RPC_URLS } from '@capabilities/network/sorobanRpc';
import type { PaymentGatewayPort } from '@capabilities/payment/PaymentGateway';
import type {
  TransactionSubmissionResult,
  TransactionReconciliationResult,
} from '@capabilities/transaction/submission';
import { validContractBaseUnits } from '@capabilities/assets/contractAssets';
import { nativeAvailable } from '@capabilities/stellar/classicAmounts';

type ClassicRead = Pick<PaymentGatewayPort, 'loadAccountState' | 'loadLedgerParameters' | 'loadAccountAuthorization'>;
type RpcServer = Pick<
  InstanceType<typeof rpc.Server>,
  'getNetwork' | 'getAccount' | 'simulateTransaction' | 'sendTransaction' | 'getTransaction'
>;
const MAX_TOTAL_FEE = 10_000_000n;
const EXPIRY_SECONDS = 120;
const MAX_XDR_LENGTH = 200_000;

function hashHex(tx: Transaction): string {
  return Array.from(tx.hash())
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
function exactUnsignedTx(value: string, passphrase: string): Transaction {
  if (!value || value.length > MAX_XDR_LENGTH) throw new Error('contract-transfer-xdr');
  const tx = new Transaction(value, passphrase);
  if (tx.toXdr() !== value) throw new Error('contract-transfer-xdr');
  return tx;
}
function expectedCall(operation: ContractTransferOperation) {
  if (
    !StrKey.isValidContract(operation.contractId) ||
    !StrKey.isValidEd25519PublicKey(operation.source) ||
    !StrKey.isValidEd25519PublicKey(operation.destination) ||
    !validContractBaseUnits(operation.baseUnits) ||
    BigInt(operation.baseUnits) <= 0n ||
    operation.source === operation.destination
  )
    throw new Error('contract-transfer-invalid');
  const args = [
    Address.fromString(operation.source).toScVal(),
    Address.fromString(operation.destination).toScVal(),
    nativeToScVal(BigInt(operation.baseUnits), { type: 'i128' }),
  ];
  return new xdr.InvokeContractArgs({
    contractAddress: Address.fromString(operation.contractId).toScAddress(),
    functionName: 'transfer',
    args,
  });
}
function exactAuth(auth: readonly xdr.SorobanAuthorizationEntry[], call: xdr.InvokeContractArgs): boolean {
  if (!Array.isArray(auth) || auth.length !== 1) return false;
  const entry = auth[0]!;
  const root = entry.rootInvocation;
  return (
    entry.credentials.type === 'sorobanCredentialsSourceAccount' &&
    root.subInvocations.length === 0 &&
    root.function.type === 'sorobanAuthorizedFunctionTypeContractFn' &&
    root.function.value.toXdr('base64') === call.toXdr('base64')
  );
}
function feeValue(value: string): bigint {
  if (!/^(0|[1-9]\d{0,9})$/.test(value)) throw new Error('contract-transfer-fee');
  return BigInt(value);
}
export function createStellarContractTransferGateway(
  network: NetworkContext,
  classic: ClassicRead,
  now: () => number = Date.now,
  injected?: RpcServer,
): ContractTransferGateway {
  const id = network.id;
  if (
    (id !== 'stellar-mainnet' && id !== 'stellar-testnet') ||
    network.networkPassphrase !== NETWORKS[id].networkPassphrase
  )
    throw new Error('contract-transfer-network');
  const rpcUrl = SOROBAN_RPC_URLS[id];
  let server = injected;
  async function verified() {
    const result = server ?? (server = new rpc.Server(rpcUrl, { timeout: 10_000 }));
    const identity = await result.getNetwork();
    if (identity.passphrase !== network.networkPassphrase) throw new Error('contract-transfer-network');
    return result;
  }
  async function loadTransactionOutcome(hash: string): Promise<TransactionReconciliationResult> {
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('contract-transfer-hash');
    const response = await (await verified()).getTransaction(hash);
    if (response.txHash !== hash) throw new Error('contract-transfer-hash');
    if (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND)
      return { status: 'still-unknown', transactionHash: hash };
    if (
      response.feeBump ||
      !Number.isSafeInteger(response.ledger) ||
      response.ledger <= 0 ||
      hashHex(new Transaction(response.envelopeXdr, network.networkPassphrase)) !== hash
    )
      throw new Error('contract-transfer-outcome');
    if (response.status === rpc.Api.GetTransactionStatus.SUCCESS)
      return { status: 'confirmed', transactionHash: hash, ledger: response.ledger };
    if (response.status === rpc.Api.GetTransactionStatus.FAILED) return { status: 'rejected', transactionHash: hash };
    throw new Error('contract-transfer-outcome');
  }
  return {
    network,
    async prepare(operation) {
      const call = expectedCall(operation);
      const connection = await verified();
      const source = await classic.loadAccountState(operation.source);
      const recipient = await classic.loadAccountState(operation.destination);
      const ledger = await classic.loadLedgerParameters();
      if (
        source.status !== 'active' ||
        source.account.address !== operation.source ||
        recipient.status !== 'active' ||
        recipient.account.address !== operation.destination ||
        recipient.account.memoRequired
      )
        throw new Error('contract-transfer-account');
      const baseFee = BigInt(ledger.baseFeeStroops);
      if (baseFee <= 0n || baseFee > MAX_TOTAL_FEE) throw new Error('contract-transfer-fee');
      const account = await connection.getAccount(operation.source);
      if (account.accountId() !== operation.source) throw new Error('contract-transfer-account');
      const expiresAtUnixSeconds = Math.floor(now() / 1000) + EXPIRY_SECONDS;
      const raw = new TransactionBuilder(new Account(operation.source, account.sequenceNumber()), {
        fee: String(baseFee),
        networkPassphrase: network.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: operation.contractId,
            function: 'transfer',
            args: call.args,
          }),
        )
        .setTimebounds(0, expiresAtUnixSeconds)
        .build();
      const simulation = await connection.simulateTransaction(raw);
      if (
        !rpc.Api.isSimulationSuccess(simulation) ||
        rpc.Api.isSimulationRestore(simulation) ||
        !simulation.result ||
        simulation.result.retval.type !== 'scvVoid' ||
        !Number.isSafeInteger(simulation.latestLedger) ||
        simulation.latestLedger <= 0 ||
        !exactAuth(simulation.result.auth, call)
      )
        throw new Error('contract-transfer-simulation');
      const resourceFee = feeValue(simulation.minResourceFee);
      const total = baseFee + resourceFee;
      if (resourceFee <= 0n || total > MAX_TOTAL_FEE) throw new Error('contract-transfer-fee');
      const available = nativeAvailable(source.account, ledger, total);
      if (
        operation.contractId === Asset.native().contractId(network.networkPassphrase) &&
        BigInt(operation.baseUnits) > available
      )
        throw new Error('contract-transfer-balance');
      const built = rpc.assembleTransaction(raw, simulation).build();
      const op = built.operations[0];
      const envelope = built.toEnvelope();
      if (
        built.source !== operation.source ||
        built.sequence !== raw.sequence ||
        built.signatures.length !== 0 ||
        built.operations.length !== 1 ||
        !op ||
        op.type !== 'invokeHostFunction' ||
        op.source !== undefined ||
        op.func.type !== 'hostFunctionTypeInvokeContract' ||
        op.func.value.toXdr('base64') !== call.toXdr('base64') ||
        !exactAuth(op.auth ?? [], call) ||
        built.memo.type !== 'none' ||
        built.fee !== String(total) ||
        built.timeBounds?.minTime !== '0' ||
        built.timeBounds.maxTime !== String(expiresAtUnixSeconds) ||
        envelope.type !== 'envelopeTypeTx' ||
        envelope.value.tx.ext.type !== 'sorobanData' ||
        String(envelope.value.tx.ext.value.resourceFee) !== String(resourceFee) ||
        Math.floor(now() / 1000) >= expiresAtUnixSeconds
      )
        throw new Error('contract-transfer-review');
      const transactionXdrBase64 = built.toXdr();
      if (transactionXdrBase64.length > MAX_XDR_LENGTH) throw new Error('contract-transfer-xdr');
      return Object.freeze({
        transactionXdrBase64,
        networkId: network.id,
        source: operation.source,
        fee: built.fee,
        resourceFee: String(resourceFee),
        expiresAtUnixSeconds,
        hash: hashHex(built),
      });
    },
    async loadAccountAuthorization(address) {
      await verified();
      const authorization = await classic.loadAccountAuthorization(address);
      if (authorization.address !== address) throw new Error('contract-transfer-account');
      return authorization;
    },
    transactionHash: signed => hashHex(exactUnsignedTx(signed, network.networkPassphrase)),
    verifySigned(review: BuiltContractTransfer, signedXdr: string, signerPublicKey: string) {
      const unsigned = exactUnsignedTx(review.transactionXdrBase64, network.networkPassphrase);
      const signed = exactUnsignedTx(signedXdr, network.networkPassphrase);
      if (
        review.networkId !== network.id ||
        unsigned.signatures.length !== 0 ||
        signed.signatures.length !== 1 ||
        hashHex(unsigned) !== review.hash ||
        hashHex(signed) !== review.hash ||
        !Keypair.fromPublicKey(signerPublicKey).verify(signed.hash(), signed.signatures[0]!.signature)
      )
        throw new Error('contract-transfer-signature');
    },
    loadTransactionOutcome,
    async submitTransaction(signedXdr): Promise<TransactionSubmissionResult> {
      const signed = exactUnsignedTx(signedXdr, network.networkPassphrase);
      const hash = hashHex(signed);
      try {
        const response = await (await verified()).sendTransaction(signed);
        if (response.hash !== hash) return { status: 'uncertain', transactionHash: hash };
        // An RPC admission result is not ledger confirmation. Reconcile the
        // original hash, including DUPLICATE/TRY_AGAIN_LATER/transport errors.
        const outcome = await loadTransactionOutcome(hash);
        if (outcome.status === 'confirmed') return { status: 'accepted', hash, ledger: outcome.ledger };
        if (outcome.status === 'rejected') return outcome;
        if (response.status === 'ERROR' && response.errorResult) {
          const code = response.errorResult.result.type;
          // Sequence/expiry errors can also describe an already-admitted
          // envelope; do not release its intent on absence alone.
          if (
            [
              'txInsufficientFee',
              'txBadAuth',
              'txInsufficientBalance',
              'txMalformed',
              'txNoAccount',
              'txBadAuthExtra',
            ].includes(code)
          )
            return { status: 'rejected', transactionHash: hash, resultCode: code };
        }
      } catch {
        // Existing durable pending pipeline owns all unknown outcomes.
      }
      return { status: 'uncertain', transactionHash: hash };
    },
  };
}
