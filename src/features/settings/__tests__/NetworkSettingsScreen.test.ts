import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { defaultTheme } from '../../../ui/theme';
import { NetworkNodeHealth } from '../NetworkNodeHealth';
import { NetworkSettingsScreen } from '../NetworkSettingsScreen';
import { NetworkManagement } from '../NetworkManagement';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { createStyles } from '../NetworkSettingsScreen.styles';

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

jest.mock('@fresnica/ui-native', () => ({
  Button: () => null,
}));

jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

type NodeProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  value?: string;
  onPress?: () => void;
  size?: string;
  variant?: string;
  scrollable?: boolean;
  contentInset?: string;
  showsVerticalScrollIndicator?: boolean;
  style?: unknown;
  selectable?: boolean;
  numberOfLines?: number;
  section?: string;
}>;

function findAll(
  root: React.ReactNode,
  predicate: (element: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps>[] {
  const found: React.ReactElement<NodeProps>[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<NodeProps>(node)) return;
    if (predicate(node)) found.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(root);
  return found;
}

function displayedText(root: React.ReactNode): string[] {
  return findAll(root, element => element.type === Text).flatMap(element =>
    React.Children.toArray(element.props.children).filter((child): child is string => typeof child === 'string'),
  );
}

const monitor = {
  getSnapshot: () => ({ endpoint: 'https://horizon-testnet.example', generation: 0, phase: 'healthy' as const }),
  subscribe: () => () => {},
  retry: jest.fn(),
};

describe('Network Settings native Back and read-only contract', () => {
  it('keeps initial-setup authentication reachable while the Settings child shows only node tools', () => {
    const settings = {} as NetworkSettings;
    const render = (showBack: boolean) =>
      NetworkSettingsScreen({
        onBack: jest.fn(),
        showBack,
        monitor,
        settings,
        network: { id: 'stellar-mainnet', horizonUrl: 'https://horizon.stellar.org', isMainnet: true },
      });
    expect(findAll(render(false), n => n.type === NetworkManagement)[0]?.props.section).toBe('all');
    expect(findAll(render(true), n => n.type === NetworkManagement)[0]?.props.section).toBe('nodes');
  });
  it('keeps Back callback, App-owned safe area, and original hidden-indicator ScrollView', () => {
    const onBack = jest.fn();
    const root = NetworkSettingsScreen({
      onBack,
      monitor,
      network: { id: 'stellar-testnet', horizonUrl: 'https://horizon-testnet.example', isMainnet: false },
    });

    const [back] = findAll(root, element => element.type === NativeButton);
    expect(back?.props).toMatchObject({ label: 'Back', size: 'sm', variant: 'quiet', onPress: onBack });
    back?.props.onPress?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(findAll(root, element => element.type === NetworkNodeHealth)[0]?.props).toEqual({ monitor });
    expect(findAll(root, element => element.type === NativeButton)).toHaveLength(1);
    expect(findAll(root, element => element.type === Pressable)).toHaveLength(0);
    expect(findAll(root, element => element.type === Screen)[0]?.props).toMatchObject({
      scrollable: false,
      contentInset: 'none',
    });
    expect(findAll(root, element => element.type === ScrollView)[0]?.props.showsVerticalScrollIndicator).toBe(false);
  });

  it('keeps Network title centered using equal flexible sides, not the old 42dp spacer', () => {
    const root = NetworkSettingsScreen({
      onBack: jest.fn(),
      monitor,
      network: { id: 'public', horizonUrl: 'https://horizon.example', isMainnet: true },
    });
    const styles = createStyles(defaultTheme);
    const header = React.Children.toArray(root.props.children).find(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child) && child.type === View,
    );
    expect(header?.props.style).toEqual(styles.header);
    const columns = React.Children.toArray(header?.props.children).filter(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
    );
    expect(columns).toHaveLength(3);
    const [left, title, right] = columns;

    expect(left?.type).toBe(View);
    expect(title?.type).toBe(Text);
    expect(title?.props.children).toBe('Network');
    expect(right?.type).toBe(View);
    expect(left?.props.style).toEqual(styles.headerSide);
    expect(right?.props.style).toEqual(styles.headerSide);
    expect(styles.headerSide).toMatchObject({ flex: 1, alignItems: 'flex-start' });
    expect(styles.header).not.toHaveProperty('justifyContent', 'space-between');
    expect(styles.header.minHeight).toBe(58);
    expect(
      React.Children.toArray(left?.props.children).some(
        child => React.isValidElement(child) && child.type === NativeButton,
      ),
    ).toBe(true);
  });

  it('preserves Testnet/Mainnet read-only states and exact network/Horizon projections', () => {
    for (const network of [
      { id: 'testnet-network-passphrase', horizonUrl: 'https://horizon-testnet.example', isMainnet: false },
      { id: 'public-network-passphrase', horizonUrl: 'https://horizon-mainnet.example', isMainnet: true },
    ]) {
      const root = NetworkSettingsScreen({ onBack: jest.fn(), network, monitor });
      const shown = displayedText(root);
      const infoRows = findAll(
        root,
        element => element.props.label === 'Network ID' || element.props.label === 'Horizon',
      );

      expect(shown).toContain(network.isMainnet ? 'Stellar Mainnet' : 'Stellar Testnet');
      expect(shown).toContain('Active');
      expect(shown).toContain('Read-only network profile');
      expect(shown.join(' ')).toContain('read-only');
      expect(infoRows.map(row => [row.props.label, row.props.value])).toEqual([
        ['Network ID', network.id],
        ['Horizon', network.horizonUrl],
      ]);
      expect(infoRows[1]?.props.value).toBe(network.horizonUrl);
      expect(findAll(root, element => element.type === NativeButton)).toHaveLength(1);
      expect(findAll(root, element => element.type === Pressable)).toHaveLength(0);
    }
  });
});
