import type {HistoryEntry} from '../../capabilities/history/types';

export function mergeHistoryEntries(
  current: readonly HistoryEntry[],
  incoming: readonly HistoryEntry[],
): HistoryEntry[] {
  const seen = new Set(current.map(entry => entry.id));
  const merged = [...current];

  for (const entry of incoming) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      merged.push(entry);
    }
  }

  return merged;
}

export function historyEntryPresentation(entry: HistoryEntry): Readonly<{
  title: string;
  primary: string;
  secondary: string;
}> {
  switch (entry.kind) {
    case 'payment': {
      const asset = entry.asset.code;
      const directionLabel =
        entry.direction === 'incoming'
          ? 'Received'
          : entry.direction === 'outgoing'
            ? 'Sent'
            : entry.direction === 'self'
              ? 'Self payment'
              : 'Payment';
      return {
        title: directionLabel,
        primary: `${entry.amount} ${asset}`,
        secondary: entry.counterparty,
      };
    }
    case 'create-account':
      return {
        title: entry.direction === 'incoming' ? 'Account funded' : 'Funded account',
        primary: `${entry.startingBalance} XLM`,
        secondary: entry.counterparty,
      };
    case 'unsupported':
      return {
        title: `Operation: ${entry.operationType}`,
        primary: 'This operation is recorded but not specialized in this version.',
        secondary: entry.transactionHash,
      };
  }
}
