import React from 'react';

import { Button } from '@ui/components';

import { InactiveAccountPanel } from '../InactiveAccountPanel';

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

type TestProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  disabled?: boolean;
  onPress?: () => void;
}>;

function buttons(root: React.ReactNode): React.ReactElement<TestProps>[] {
  const matches: React.ReactElement<TestProps>[] = [];
  visit(root, element => {
    if (element.type === Button) matches.push(element);
  });
  return matches;
}

function textValues(node: React.ReactNode): string[] {
  if (typeof node === 'string') return [node];
  if (!React.isValidElement<TestProps>(node)) return [];
  return React.Children.toArray(node.props.children).flatMap(textValues);
}

function visit(node: React.ReactNode, callback: (element: React.ReactElement<TestProps>) => void): void {
  if (!React.isValidElement<TestProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

describe('InactiveAccountPanel', () => {
  const baseProps = {
    address: 'GACCOUNT',
    friendbotAvailable: true,
    onFundWithFriendbot: jest.fn(),
    onRefresh: jest.fn(),
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers Friendbot and refresh for an eligible inactive account', () => {
    const root = InactiveAccountPanel({ ...baseProps, friendbotState: 'idle' });
    const renderedButtons = buttons(root);

    expect(renderedButtons.map(button => button.props.label)).toEqual([
      'home.friendbot.action',
      'home.inactive.refreshAction',
    ]);
    expect(renderedButtons[0]?.props.disabled).toBe(false);
  });
  it('disables duplicate funding while Friendbot is in progress', () => {
    const root = InactiveAccountPanel({ ...baseProps, friendbotState: 'funding' });
    const renderedButtons = buttons(root);

    expect(renderedButtons[0]?.props.label).toBe('home.friendbot.funding');
    expect(renderedButtons[0]?.props.disabled).toBe(true);
  });

  it('keeps Friendbot retryable and shows localized failure copy', () => {
    const root = InactiveAccountPanel({ ...baseProps, friendbotState: 'error' });
    const renderedButtons = buttons(root);

    expect(renderedButtons[0]?.props.label).toBe('home.friendbot.action');
    expect(renderedButtons[0]?.props.disabled).toBe(false);
    expect(textValues(root)).toContain('home.friendbot.error');
  });

  it('does not render Friendbot outside an eligible network state', () => {
    const root = InactiveAccountPanel({
      ...baseProps,
      friendbotAvailable: false,
      friendbotState: 'idle',
    });

    expect(buttons(root).map(button => button.props.label)).toEqual(['home.inactive.refreshAction']);
  });
});
