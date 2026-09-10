import type { AccountRecord } from '../account/types';
import type { HistoryGatewayPort, HistoryOperationRecord } from './HistoryGateway';
import type {
  HistoryAsset,
  HistoryCreateAccountEntry,
  HistoryDirection,
  HistoryEntry,
  HistoryEntryBase,
  HistoryPage,
  HistoryPaymentEntry,
  HistoryUnsupportedEntry,
} from './types';

export type HistoryDependencies = Readonly<{
  gateway: HistoryGatewayPort;
  networkId: string;
}>;

const DEFAULT_HISTORY_PAGE_SIZE = 20;

export async function loadHistoryPage(
  dependencies: HistoryDependencies,
  account: AccountRecord,
  input?: Readonly<{ cursor?: string; limit?: number }>,
): Promise<HistoryPage> {
  if (account.networkId !== dependencies.networkId) {
    throw new Error('history-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    return { status: 'unsupported-account' };
  }

  const page = await dependencies.gateway.loadAccountOperations({
    address: account.address,
    ...(input?.cursor === undefined ? {} : { cursor: input.cursor }),
    limit: input?.limit ?? DEFAULT_HISTORY_PAGE_SIZE,
  });

  if (page.status === 'inactive') {
    return { status: 'inactive' };
  }

  return {
    status: 'active',
    entries: page.records.map(record => mapHistoryEntry(record, account.address)),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}

export function mapHistoryEntry(record: HistoryOperationRecord, accountAddress: string): HistoryEntry {
  const base = mapBase(record);

  switch (record.type) {
    case 'payment':
      return mapPayment(record, accountAddress, base);
    case 'create_account':
      return mapCreateAccount(record, accountAddress, base);
    default:
      return Object.freeze({
        ...base,
        kind: 'unsupported',
        reason: 'operation-type',
      } satisfies HistoryUnsupportedEntry);
  }
}

function mapBase(record: HistoryOperationRecord): HistoryEntryBase {
  const id = nonEmpty(record.id) ?? nonEmpty(record.pagingToken);
  const pagingToken = nonEmpty(record.pagingToken);
  const operationType = nonEmpty(record.type);
  const occurredAt = nonEmpty(record.occurredAt);
  const transactionHash = nonEmpty(record.transactionHash);
  const sourceAccount = nonEmpty(record.sourceAccount);

  if (
    !id ||
    !pagingToken ||
    !operationType ||
    !occurredAt ||
    !transactionHash ||
    !sourceAccount ||
    !Number.isFinite(Date.parse(occurredAt))
  ) {
    throw new Error('invalid-history-operation-common-fields');
  }

  return Object.freeze({
    id,
    pagingToken,
    operationType,
    occurredAt,
    transactionHash,
    sourceAccount,
  });
}

function mapPayment(record: HistoryOperationRecord, accountAddress: string, base: HistoryEntryBase): HistoryEntry {
  const sender = nonEmpty(record.from) ?? base.sourceAccount;
  const recipientBase = nonEmpty(record.to);
  const recipientDisplay = nonEmpty(record.toMuxed) ?? recipientBase;
  const amount = nonEmpty(record.amount);
  const asset = mapAsset(record);

  if (!sender || !recipientBase || !recipientDisplay || !amount || !asset) {
    return unsupportedShape(base);
  }

  return Object.freeze({
    ...base,
    kind: 'payment',
    direction: paymentDirection(accountAddress, sender, recipientBase),
    amount,
    asset: Object.freeze(asset),
    counterparty:
      sender === accountAddress && recipientBase === accountAddress
        ? recipientDisplay
        : sender === accountAddress
          ? recipientDisplay
          : sender,
  } satisfies HistoryPaymentEntry);
}

function mapCreateAccount(
  record: HistoryOperationRecord,
  accountAddress: string,
  base: HistoryEntryBase,
): HistoryEntry {
  const funder = nonEmpty(record.funder) ?? base.sourceAccount;
  const createdAccount = nonEmpty(record.account);
  const startingBalance = nonEmpty(record.startingBalance);
  if (!funder || !createdAccount || !startingBalance) {
    return unsupportedShape(base);
  }

  return Object.freeze({
    ...base,
    kind: 'create-account',
    direction: flowDirection(accountAddress, funder, createdAccount),
    startingBalance,
    counterparty: funder === accountAddress ? createdAccount : funder,
  } satisfies HistoryCreateAccountEntry);
}

function mapAsset(record: HistoryOperationRecord): HistoryAsset | undefined {
  if (record.asset?.kind === 'native') {
    return { kind: 'native', code: 'XLM' };
  }

  if (record.asset?.kind === 'credit' && nonEmpty(record.asset.code) && nonEmpty(record.asset.issuer)) {
    return {
      kind: 'credit',
      code: record.asset.code!,
      issuer: record.asset.issuer!,
    };
  }

  return undefined;
}

function paymentDirection(accountAddress: string, sender: string, recipientBase: string): HistoryDirection {
  return flowDirection(accountAddress, sender, recipientBase);
}

function flowDirection(accountAddress: string, source: string, destination: string): HistoryDirection {
  const fromSelf = source === accountAddress;
  const toSelf = destination === accountAddress;
  if (fromSelf && toSelf) {
    return 'self';
  }
  if (fromSelf) {
    return 'outgoing';
  }
  if (toSelf) {
    return 'incoming';
  }
  return 'neutral';
}

function unsupportedShape(base: HistoryEntryBase): HistoryUnsupportedEntry {
  return Object.freeze({
    ...base,
    kind: 'unsupported',
    reason: 'operation-shape',
  });
}

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
