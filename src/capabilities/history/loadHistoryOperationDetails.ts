import { contractAssociated } from './contractHistory';
import { isMaintenanceType } from './maintenanceHistory';
import { isTrustSponsorshipType, trustSponsorshipAssociated } from './trustSponsorshipHistory';
import { isClaimableClawbackType, claimableClawbackAssociated } from './claimableClawbackHistory';
import { isOfferType, isPoolType } from './offerPoolHistory';
import type { AccountRecord } from '../account/types';
import type { HistoryOperationRecord } from './HistoryGateway';
import { mapHistoryEntry, type HistoryDependencies } from './loadHistoryPage';
import type { HistoryEntry } from './types';

export type HistoryOperationDetails =
  | Readonly<{ status: 'ready'; entry: HistoryEntry }>
  | Readonly<{ status: 'not-found' }>
  | Readonly<{ status: 'not-associated' }>
  | Readonly<{ status: 'unsupported-account' }>;

export async function loadHistoryOperationDetails(
  dependencies: HistoryDependencies,
  account: AccountRecord,
  operationIdInput: string,
): Promise<HistoryOperationDetails> {
  if (account.networkId !== dependencies.networkId) {
    throw new Error('history-network-mismatch');
  }
  if (account.identityKind !== 'classic') {
    return { status: 'unsupported-account' };
  }

  const operationId = operationIdInput.trim();
  if (!operationId) {
    throw new Error('invalid-history-operation-id');
  }

  const result = await dependencies.gateway.loadOperation({ operationId, accountAddress: account.address });
  if (result.status === 'not-found') {
    return { status: 'not-found' };
  }
  if (result.record.id !== operationId) {
    throw new Error('history-operation-id-mismatch');
  }
  if (!isOperationAssociatedWithAccount(result.record, account.address)) {
    return { status: 'not-associated' };
  }

  return {
    status: 'ready',
    entry: mapHistoryEntry(result.record, account.address),
  };
}

function isOperationAssociatedWithAccount(record: HistoryOperationRecord, address: string): boolean {
  if (isTrustSponsorshipType(record.type)) return trustSponsorshipAssociated(record, address);
  if (isMaintenanceType(record.type)) return record.sourceAccount === address;
  if (record.type === 'invoke_host_function') return contractAssociated(record, address);
  if (isClaimableClawbackType(record.type)) return claimableClawbackAssociated(record, address);
  if (isOfferType(record.type) || isPoolType(record.type)) return record.sourceAccount === address;
  if (
    [record.sourceAccount, record.from, record.to, record.funder, record.account].some(
      candidate => candidate === address,
    )
  ) {
    return true;
  }

  if (record.type !== 'change_trust') {
    return false;
  }

  const issuer = record.asset?.kind === 'credit' ? record.asset.issuer : undefined;
  return [record.trustor, record.trustee, issuer].some(candidate => candidate === address);
}
