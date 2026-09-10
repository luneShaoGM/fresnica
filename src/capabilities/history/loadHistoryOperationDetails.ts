import type {AccountRecord} from '../account/types';
import type {HistoryOperationRecord} from './HistoryGateway';
import {mapHistoryEntry, type HistoryDependencies} from './loadHistoryPage';
import type {HistoryEntry} from './types';

export type HistoryOperationDetails =
  | Readonly<{status: 'ready'; entry: HistoryEntry}>
  | Readonly<{status: 'not-found'}>
  | Readonly<{status: 'not-associated'}>
  | Readonly<{status: 'unsupported-account'}>;

export async function loadHistoryOperationDetails(
  dependencies: HistoryDependencies,
  account: AccountRecord,
  operationIdInput: string,
): Promise<HistoryOperationDetails> {
  if (account.networkId !== dependencies.networkId) {
    throw new Error('history-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    return {status: 'unsupported-account'};
  }

  const operationId = operationIdInput.trim();
  if (!operationId) {
    throw new Error('invalid-history-operation-id');
  }

  const result = await dependencies.gateway.loadOperation({operationId});
  if (result.status === 'not-found') {
    return {status: 'not-found'};
  }
  if (result.record.id !== operationId) {
    throw new Error('history-operation-id-mismatch');
  }
  if (!isOperationAssociatedWithAccount(result.record, account.address)) {
    return {status: 'not-associated'};
  }

  return {
    status: 'ready',
    entry: mapHistoryEntry(result.record, account.address),
  };
}

function isOperationAssociatedWithAccount(record: HistoryOperationRecord, address: string): boolean {
  return [record.sourceAccount, record.from, record.to, record.funder, record.account].some(
    candidate => candidate === address,
  );
}
