export type AccountSelectionPreferenceStore = Readonly<{
  getDefaultAccountId: (networkId: string) => string | undefined;
  setDefaultAccountId: (networkId: string, accountId: string) => void;
  clearDefaultAccountId: (networkId: string) => void;
}>;
