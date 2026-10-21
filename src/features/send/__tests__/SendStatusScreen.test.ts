import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeStateView } from '@ui/components/NativeStateView';
import { defaultTheme } from '@ui/theme';

import { SendStatusScreen } from '../SendStatusScreen';
import { createSendStatusStyles } from '../styles';

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
  useLocalization: () => ({ t: (key: string) => ({ 'common.back': 'localized:back' })[key] ?? key }),
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  style?: unknown;
  label?: string;
  onPress?: () => void;
  variant?: string;
  size?: string;
  disabled?: boolean;
  scrollable?: boolean;
  contentInset?: string;
  color?: string;
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

function inspect(title: string, message: string, loading: boolean) {
  const onBack = jest.fn();
  const root = SendStatusScreen({ title, message, loading, onBack });
  const styles = createSendStatusStyles(defaultTheme);
  const [header, body] = React.Children.toArray(root.props.children).filter(
    (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
  );
  const [left, heading, right] = React.Children.toArray(header?.props.children).filter(
    (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
  );
  const back = elements(left).filter(child => child.type === NativeButton);
  expect(root.type).toBe(Screen);
  expect(root.props).toMatchObject({ scrollable: false, contentInset: 'none' });
  expect(header?.type).toBe(View);
  expect(header?.props.style).toEqual(styles.header);
  expect(left?.type).toBe(View);
  expect(right?.type).toBe(View);
  expect(left?.props.style).toEqual(styles.headerSide);
  expect(right?.props.style).toEqual(styles.headerSide);
  expect(styles.headerSide).toMatchObject({ flex: 1, alignItems: 'flex-start' });
  expect(styles.header).not.toHaveProperty('justifyContent', 'space-between');
  expect(styles.header.minHeight).toBe(58);
  expect(heading?.type).toBe(Text);
  expect(heading?.props.children).toBe('Send');
  expect(back).toHaveLength(1);
  expect(back[0]?.props).toMatchObject({
    label: 'localized:back',
    onPress: onBack,
    size: 'sm',
    variant: 'quiet',
  });
  expect(back[0]?.props.disabled).toBeUndefined();
  back[0]?.props.onPress?.();
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(body?.type).toBe(View);
  expect(body?.props.style).toEqual(styles.messageBody);
  return { content: elements(body), styles };
}

describe('SendStatusScreen read-only states', () => {
  it('preserves a visible loading spinner and the original loading text without transaction controls', () => {
    const { content } = inspect('Send', 'Loading current Stellar balances…', true);
    expect(content.filter(node => node.type === ActivityIndicator)).toHaveLength(1);
    expect(content.filter(node => node.type === NativeStateView)).toHaveLength(0);
    const texts = content.filter(node => node.type === Text).map(node => node.props.children);
    expect(texts).toContain('Send');
    expect(texts).toContain('Loading current Stellar balances…');
    expect(content.filter(node => node.type === NativeButton)).toHaveLength(0);
  });

  it.each([
    ['Account not activated', 'This Stellar account must exist on Testnet before it can send a payment.'],
    ['Send unavailable', 'Classic payment Send is not applied to contract accounts.'],
    ['No assets available', 'No displayable balance is available for this account.'],
    ['request.deepLink.blocked.title', 'send.request.assetUnavailable'],
    ['Unable to load account balances', 'Public balance request failed.'],
  ])('keeps the original blocked title and explanation for %s', (title, message) => {
    const { content } = inspect(title, message, false);
    expect(content.filter(node => node.type === ActivityIndicator)).toHaveLength(0);
    const presentation = content.filter(node => node.type === NativeStateView);
    expect(presentation).toHaveLength(1);
    expect(presentation[0]?.props).toMatchObject({ title, description: message, tone: 'error' });
    expect(presentation[0]?.props.action).toBeUndefined();
    expect(content.filter(node => node.type === NativeButton)).toHaveLength(0);
  });
});
