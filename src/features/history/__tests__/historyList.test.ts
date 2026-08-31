import type {HistoryEntry} from '../../../capabilities/history/types';
import {historyEntryPresentation, mergeHistoryEntries} from '../historyList';

function unsupported(id: string): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'future_operation',
    occurredAt: '2026-08-31T00:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason: 'operation-type',
  };
}

describe('historyList', () => {
  it('appends later pages without duplicating operation ids', () => {
    expect(
      mergeHistoryEntries(
        [unsupported('3'), unsupported('2')],
        [unsupported('2'), unsupported('1')],
      ).map(entry => entry.id),
    ).toEqual(['3', '2', '1']);
  });

  it('presents unsupported operations explicitly instead of hiding them', () => {
    expect(historyEntryPresentation(unsupported('9'))).toEqual({
      title: 'Operation: future_operation',
      primary: 'This operation is recorded but not specialized in this version.',
      secondary: 'tx-9',
    });
  });
});
