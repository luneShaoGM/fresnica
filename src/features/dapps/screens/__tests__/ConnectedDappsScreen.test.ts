import React from 'react';

import type { DappReadGrant, DappPermissionStore } from '../../../../capabilities/dapp-interaction/dappPermissionStore';
import type { AccountRecord } from '../../../../capabilities/account/types';
import { NativeButton } from '../../../../ui/components/NativeButton';
import { ConnectedDappsScreen } from '../ConnectedDappsScreen';

jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => number) => getSnapshot(),
    useState: (initial: boolean) => [initial, () => undefined],
  };
});
jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
jest.mock('../../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('../../../../ui/theme', () => {
  const original = jest.requireActual('../../../../ui/theme') as typeof import('../../../../ui/theme');
  return {
    ...original,
    useThemedStyles: (factory: (theme: typeof original.defaultTheme) => unknown) => factory(original.defaultTheme),
  };
});

type NodeProps = Readonly<{ children?: React.ReactNode; label?: string; onPress?: () => void }>;
function find(
  root: React.ReactNode,
  match: (node: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(root)) return [];
  return [
    ...(match(root) ? [root] : []),
    ...React.Children.toArray(root.props.children).flatMap(child => find(child, match)),
  ];
}

const testnet = { origin: 'https://dex.example.org', networkId: 'stellar-testnet', accountId: 'wallet-1' };
const mainnet = { ...testnet, networkId: 'stellar-mainnet' };
const grants: DappReadGrant[] = [
  { ...testnet, createdAtUnixMs: 123 },
  { ...mainnet, createdAtUnixMs: 123 },
];
const revoke = jest.fn();
const permissions: DappPermissionStore = {
  has: () => false,
  grant: () => undefined,
  revoke,
  list: networkId => grants.filter(grant => grant.networkId === networkId),
  subscribe: () => () => undefined,
  getRevision: () => 1,
};
const wallet = {
  id: 'wallet-1',
  address: 'GTEST',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'My testnet',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as AccountRecord;

describe('S17 Connected dApps Settings UI', () => {
  beforeEach(() => revoke.mockReset());

  it('only lists grants for the active network and revokes an exact account/origin tuple', () => {
    const onBack = jest.fn();
    const view = ConnectedDappsScreen({
      permissions,
      accounts: [wallet],
      networkId: 'stellar-testnet',
      onBack,
    });
    const disconnect = find(
      view,
      node => node.type === NativeButton && node.props.label === 'dapps.connected.disconnect',
    );
    expect(disconnect).toHaveLength(1);
    const text = JSON.stringify(view);
    expect(text).toContain('https://dex.example.org');
    expect(text).toContain('My testnet');
    expect(text).not.toContain('stellar-mainnet');
    disconnect[0].props.onPress?.();
    expect(revoke).toHaveBeenCalledWith(testnet);
    find(view, node => node.type === NativeButton && node.props.label === 'common.back')[0].props.onPress?.();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not misrepresent an unavailable permission store as an empty grant list', () => {
    const failed = {
      ...permissions,
      list: () => {
        throw new Error('db-unavailable');
      },
    };
    const view = ConnectedDappsScreen({
      permissions: failed,
      accounts: [wallet],
      networkId: 'stellar-testnet',
      onBack: () => undefined,
    });
    expect(JSON.stringify(view)).toContain('dapps.connected.loadFailed');
    expect(JSON.stringify(view)).not.toContain('dapps.connected.empty');
  });

  it('shows a truthful empty state when there are no grants for this network', () => {
    const view = ConnectedDappsScreen({
      permissions,
      accounts: [wallet],
      networkId: 'stellar-futurenet',
      onBack: () => undefined,
    });
    expect(
      find(view, node => node.type === NativeButton && node.props.label === 'dapps.connected.disconnect'),
    ).toHaveLength(0);
    expect(JSON.stringify(view)).toContain('dapps.connected.empty');
  });
});
