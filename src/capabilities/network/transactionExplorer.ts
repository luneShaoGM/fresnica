const TRANSACTION_HASH_PATTERN = /^[0-9a-fA-F]{64}$/;

const TRANSACTION_EXPLORER_PREFIXES: Readonly<Record<string, string>> = Object.freeze({
  'stellar-testnet': 'https://stellar.expert/explorer/testnet/tx/',
  'stellar-mainnet': 'https://stellar.expert/explorer/public/tx/',
});

export function transactionExplorerUrl(networkId: string, transactionHash: string): string | undefined {
  if (!TRANSACTION_HASH_PATTERN.test(transactionHash)) {
    return undefined;
  }

  const prefix = TRANSACTION_EXPLORER_PREFIXES[networkId];
  return prefix === undefined ? undefined : `${prefix}${transactionHash}`;
}
