import type { DappPublicSelection } from './freighterSession';

export type DappContractTracking = Readonly<{
  canReview: (selection: DappPublicSelection, contractId: string) => boolean;
  track: (
    selection: DappPublicSelection,
    contractId: string,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ) => Promise<boolean>;
}>;
