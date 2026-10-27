import React from 'react';
import { Text } from 'react-native';

import type { NodeHealthSnapshot } from '@capabilities/network/NodeHealthMonitor';
import { NativeButton } from '@ui/components/NativeButton';
import { createLocalization } from '../../../locale/localization';
import { NetworkNodeHealth, NetworkNodeHealthContent } from '../NetworkNodeHealth';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('react', () => ({ ...jest.requireActual('react'), useSyncExternalStore: jest.fn() }));

type Props = {
  children?: React.ReactNode;
  onPress?: () => void;
  label?: string;
  selectable?: boolean;
  accessibilityLiveRegion?: string;
};
function elements(root: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(elements)];
}
function content(snapshot: NodeHealthSnapshot, retry = jest.fn()) {
  const tree = NetworkNodeHealthContent({ snapshot, onRetry: retry });
  const nodes = elements(tree);
  return {
    nodes,
    text: nodes
      .filter(node => node.type === Text)
      .map(node => node.props.children)
      .join(' '),
    buttons: nodes.filter(node => node.type === NativeButton),
    retry,
  };
}
const base = { endpoint: 'https://node.example/horizon', generation: 3 };

describe('current-node health product projection', () => {
  it.each([
    ['checking', 'Checking connection…', false],
    ['healthy', 'Connected', false],
    ['cooldown', 'Retrying connection', true],
    ['wrong-network', 'Wrong network — reads blocked', true],
    ['paused', 'Connection paused while offline or inactive', false],
    ['closed', 'Connection closed', false],
  ] as const)('renders %s honestly and exposes Retry only when useful', (phase, label, retryable) => {
    const shown = content({ ...base, phase });
    expect(shown.text).toContain(label);
    expect(shown.text).toContain('Connection status for live balances and activity.');
    expect(shown.buttons).toHaveLength(retryable ? 1 : 0);
    expect(shown.nodes.some(node => node.props.selectable && node.props.children === base.endpoint)).toBe(true);
    expect(
      shown.nodes.some(node => node.props.accessibilityLiveRegion === 'polite' && node.props.children === label),
    ).toBe(true);
    if (retryable) {
      expect(shown.text).toContain('may not run immediately');
      expect(shown.buttons[0]?.props.label).toBe('Retry connection');
      shown.buttons[0]?.props.onPress?.();
      expect(shown.retry).toHaveBeenCalledTimes(1);
    }
  });

  it.each([
    ['timeout', 'did not respond in time'],
    ['rate-limited', 'limiting requests'],
    ['unavailable', 'currently unavailable'],
    ['protocol', 'invalid response'],
  ] as const)('projects safe %s failure text', (failure, message) => {
    expect(content({ ...base, phase: 'cooldown', failure }).text).toContain(message);
    expect(content({ ...base, phase: 'checking', failure }).text).not.toContain(message);
    expect(content({ ...base, phase: 'paused', failure }).text).not.toContain(message);
  });

  it('binds the shared store snapshot and passes through the existing retry without creating requests', () => {
    const snapshot: NodeHealthSnapshot = { ...base, phase: 'healthy' };
    const monitor = { subscribe: jest.fn(), getSnapshot: jest.fn(), retry: jest.fn() };
    const useStore = jest.mocked(React.useSyncExternalStore);
    useStore.mockReturnValue(snapshot);
    const root = NetworkNodeHealth({ monitor });
    expect(useStore).toHaveBeenLastCalledWith(monitor.subscribe, monitor.getSnapshot);
    expect(root.props).toMatchObject({ snapshot, onRetry: monitor.retry });
    expect(monitor.retry).not.toHaveBeenCalled();
  });

  it.each(['en', 'zh', 'zh-TW'])('localizes new status and action messages in %s', locale => {
    const { t } = createLocalization(locale);
    for (const key of [
      'currentNode',
      'phase.checking',
      'phase.healthy',
      'phase.cooldown',
      'phase.wrong-network',
      'phase.paused',
      'phase.closed',
      'failure.timeout',
      'failure.rate-limited',
      'failure.unavailable',
      'failure.protocol',
      'readScope',
      'retryPolicy',
      'retry',
    ]) {
      expect(t(`networkHealth.${key}`)).not.toBe(`networkHealth.${key}`);
    }
  });
});
