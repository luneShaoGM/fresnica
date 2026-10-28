jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
import React from 'react';
import { Pressable } from 'react-native';
import type { MainTabBarProps } from '../MainTabBar';

jest.mock('@react-navigation/native', () => ({ getFocusedRouteNameFromRoute: () => undefined }));
jest.mock('../../OverlayHost', () => ({
  useOverlay: () => ({
    activeOverlayId: undefined,
    present: mockPresentOverlay,
    dismiss: mockDismissOverlay,
  }),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

const mockPresentOverlay = jest.fn();
const mockDismissOverlay = jest.fn();
const { MainTabBar } = require('../MainTabBar') as typeof import('../MainTabBar');
type Props = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onPress?: () => void;
}>;

function findPressable(node: React.ReactNode, label: string): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(node)) return undefined;
  if (node.type === Pressable && node.props.accessibilityLabel === label) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findPressable(child, label);
    if (found) return found;
  }
  return undefined;
}

function renderSwap(
  enabled: boolean,
  syncMode?: MainTabBarProps['syncMode'],
  node: Partial<Pick<MainTabBarProps, 'nodePhase' | 'nodeFailure' | 'onRetryNode'>> = {},
) {
  const navigate = jest.fn();
  const props = {
    state: {
      index: 0,
      routes: [
        { key: 'home', name: 'home' },
        { key: 'activity', name: 'activity' },
        { key: 'dapps', name: 'dapps' },
        { key: 'settings', name: 'settings' },
      ],
    },
    descriptors: {
      home: { options: {} },
      activity: { options: {} },
      dapps: { options: {} },
      settings: { options: {} },
    },
    navigation: { navigate, emit: jest.fn(() => ({ defaultPrevented: false })) },
    selectedAccountId: 'wallet-1',
    syncMode,
    ...node,
    actionAvailability: { send: true, swap: enabled, request: true },
  } as unknown as MainTabBarProps;
  const root = MainTabBar(props);
  const actionButton = findPressable(root, 'nav.actions');
  expect(actionButton?.props.onPress).toBeDefined();
  actionButton?.props.onPress?.();
  const overlay = mockPresentOverlay.mock.calls[0]?.[1] as React.ReactNode;
  return { navigate, overlay, root };
}

describe('Swap action uses the current account route', () => {
  beforeEach(() => {
    mockPresentOverlay.mockClear();
    mockDismissOverlay.mockClear();
  });

  it('routes eligible Swap to the current account Swap flow only', () => {
    const { navigate, overlay } = renderSwap(true);
    const button = findPressable(overlay, 'nav.swap');
    expect(button?.props.disabled).toBe(false);
    button?.props.onPress?.();
    expect(mockDismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('home', {
      screen: 'swap',
      params: { accountId: 'wallet-1' },
    });
  });

  it('keeps swap unavailable for ineligible accounts without dispatching navigation', () => {
    const { navigate, overlay } = renderSwap(false);
    const button = findPressable(overlay, 'nav.swap');
    expect(button?.props.disabled).toBe(true);
    button?.props.onPress?.();
    expect(navigate).not.toHaveBeenCalled();
  });
});

function textValues(node: React.ReactNode): string[] {
  if (typeof node === 'string') return [node];
  if (!React.isValidElement<Props>(node)) return [];
  return React.Children.toArray(node.props.children).flatMap(textValues);
}
it.each(['paused', 'connecting', 'live', 'polling'] as const)(
  'shows the fallback update cadence only while polling (%s)',
  syncMode => {
    mockPresentOverlay.mockClear();
    const { root } = renderSwap(true, syncMode);
    expect(textValues(root).includes('account.sync.polling')).toBe(syncMode === 'polling');
  },
);

function findLabel(node: React.ReactNode, label: string): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(node)) return undefined;
  if (node.props.label === label) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findLabel(child, label);
    if (found) return found;
  }
  return undefined;
}
it.each([
  ['checking', undefined, 'node.read.checking'],
  ['cooldown', 'rate-limited', 'node.read.rateLimited'],
  ['cooldown', 'unavailable', 'node.read.unavailable'],
  ['wrong-network', 'wrong-network', 'node.read.wrongNetwork'],
] as const)(
  'shows honest node state instead of a stream polling notice (%s / %s)',
  (nodePhase, nodeFailure, message) => {
    mockPresentOverlay.mockClear();
    const retry = jest.fn();
    const { root } = renderSwap(true, 'polling', { nodePhase, nodeFailure, onRetryNode: retry });
    expect(textValues(root)).toContain(message);
    expect(textValues(root)).not.toContain('account.sync.polling');
    const button = findLabel(root, 'node.read.retry');
    if (nodePhase === 'checking') expect(button).toBeUndefined();
    else {
      button?.props.onPress?.();
      expect(retry).toHaveBeenCalledTimes(1);
    }
  },
);
