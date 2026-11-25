import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { SendResultScreen, type SendTerminalResult } from '../SendResultScreen';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => ({ 'send.navigation.done': 'localized:done' })[key] ?? key }),
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
}>;

const terminalResults: ReadonlyArray<{ result: SendTerminalResult; title: string }> = [
  {
    result: { status: 'submitted', authorization: 'system-auth', hash: 'submitted-hash', ledger: 123 },
    title: 'send.result.submitted.title',
  },
  {
    result: { status: 'rejected', transactionHash: 'rejected-hash', resultCode: 'tx_bad_seq' },
    title: 'send.result.rejected.title',
  },
  {
    result: { status: 'uncertain', transactionHash: 'uncertain-hash', reason: 'pending-reconciliation' },
    title: 'send.result.uncertain.title',
  },
  { result: { status: 'watch-only' }, title: 'send.result.watch-only.title' },
  { result: { status: 'unsupported-account-signers' }, title: 'send.result.unsupported-account-signers.title' },
  { result: { status: 'unsupported-signer' }, title: 'send.result.unsupported-signer.title' },
  {
    result: { status: 'authorization-blocked', reason: 'insufficient-weight', requiredWeight: 2, availableWeight: 1 },
    title: 'send.result.authorization-blocked.title',
  },
];

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

describe('SendResultScreen terminal exit', () => {
  it.each(terminalResults)('keeps Done as a navigation-only callback for $result.status', ({ result, title }) => {
    const onDone = jest.fn();
    const root = SendResultScreen({ result, onDone });
    expect(root.type).toBe(Screen);
    expect(root.props).toMatchObject({ scrollable: false, contentInset: 'none' });

    const scrolls: React.ReactElement<NodeProps>[] = [];
    const titles: string[] = [];
    const buttons: React.ReactElement<NodeProps>[] = [];
    visit(root, element => {
      if (element.type === ScrollView) scrolls.push(element);
      if (element.type === Text && typeof element.props.children === 'string') titles.push(element.props.children);
      if (element.type === NativeButton) buttons.push(element);
    });

    expect(scrolls).toHaveLength(1);
    expect(scrolls[0]?.props.showsVerticalScrollIndicator).toBe(false);
    expect(titles).toContain(title);
    expect(titles).toContain(`send.result.${result.status}.description`);
    const details: string[] = [];
    visit(root, node => { if (node.props.value) details.push(node.props.value); });
    if ('hash' in result) expect(details).toContain(result.hash);
    if ('transactionHash' in result) expect(details).toContain(result.transactionHash);
    if (result.status === 'rejected' && result.resultCode) expect(details).toContain(result.resultCode);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.props).toMatchObject({
      label: 'localized:done',
      onPress: onDone,
      size: 'lg',
      variant: 'primary',
    });
    const bottom = React.Children.toArray(root.props.children).find(
      (element): element is React.ReactElement<NodeProps> =>
        React.isValidElement<NodeProps>(element) &&
        element.type === View &&
        React.Children.toArray(element.props.children).some(
          child => React.isValidElement(child) && child.type === NativeButton,
        ),
    );
    expect(bottom).toBeDefined();
    buttons[0]?.props.onPress?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
