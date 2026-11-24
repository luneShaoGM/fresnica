import React from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';

import { NativeStateView } from '@ui/components/NativeStateView';

import { SendEntryStatus } from '../SendEntryStatus';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  title?: string;
  description?: string;
  tone?: string;
  action?: React.ReactNode;
}>;

function elements(node: React.ReactNode): React.ReactElement<NodeProps>[] {
  const values: React.ReactElement<NodeProps>[] = [];
  const walk = (candidate: React.ReactNode) => {
    if (!React.isValidElement<NodeProps>(candidate)) return;
    values.push(candidate);
    React.Children.forEach(candidate.props.children, walk);
  };
  walk(node);
  return values;
}

describe('Send entry status', () => {
  it('shows only the loading message and spinner while balances are being read', () => {
    const content = elements(SendEntryStatus({ state: { kind: 'loading' } }));
    expect(content[0]?.type).toBe(ScrollView);
    expect(content.filter(node => node.type === ActivityIndicator)).toHaveLength(1);
    expect(content.filter(node => node.type === NativeStateView)).toHaveLength(0);
    expect(content.filter(node => node.type === Text).map(node => node.props.children)).toEqual([
      'send.loading.balances',
    ]);
  });

  it.each([
    ['Account not activated', 'This Stellar account must exist on Testnet before it can send a payment.'],
    ['Send unavailable', 'Classic payment Send is not applied to contract accounts.'],
    ['No assets available', 'No displayable balance is available for this account.'],
    ['request.deepLink.blocked.title', 'send.request.assetUnavailable'],
    ['Unable to load account balances', 'Public balance request failed.'],
  ])('keeps the original blocked title and explanation for %s', (title, message) => {
    const content = elements(SendEntryStatus({ state: { kind: 'blocked', title, description: message } }));
    expect(content.filter(node => node.type === ActivityIndicator)).toHaveLength(0);
    const presentation = content.filter(node => node.type === NativeStateView);
    expect(presentation).toHaveLength(1);
    expect(presentation[0]?.props).toMatchObject({ title, description: message, tone: 'error' });
    expect(presentation[0]?.props.action).toBeUndefined();
  });
});
