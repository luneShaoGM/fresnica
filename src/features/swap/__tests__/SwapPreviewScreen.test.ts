import React from 'react';
import { Text } from 'react-native';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { PreparedPathPaymentReview } from '../../../capabilities/path-payment/types';
import { NativeButton } from '../../../ui/components/NativeButton';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
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

const react = jest.requireActual<typeof import('react')>('react');
const stateSlots: Array<{ current: unknown }> = [];
const refSlots: Array<{ current: unknown }> = [];
let stateCursor = 0;
let refCursor = 0;
jest.spyOn(react, 'useState').mockImplementation(((initial: unknown) => {
  const index = stateCursor++;
  if (!stateSlots[index])
    stateSlots[index] = { current: typeof initial === 'function' ? (initial as () => unknown)() : initial };
  return [
    stateSlots[index].current,
    (value: unknown) => {
      const current = stateSlots[index].current;
      stateSlots[index].current = typeof value === 'function' ? (value as (prev: unknown) => unknown)(current) : value;
    },
  ];
}) as typeof react.useState);
jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => {
  const index = refCursor++;
  if (!refSlots[index]) refSlots[index] = { current: initial };
  return refSlots[index];
}) as typeof react.useRef);
jest.spyOn(react, 'useEffect').mockImplementation((() => undefined) as typeof react.useEffect);
jest.spyOn(react, 'useCallback').mockImplementation(((callback: unknown) => callback) as typeof react.useCallback);

const { SwapPreviewScreen } = require('../SwapPreviewScreen') as typeof import('../SwapPreviewScreen');
const account: AccountRecord = {
  id: 'a',
  address: 'GSOURCE',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'Main',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const issued = { kind: 'credit' as const, code: 'USD', issuer: 'GISSUER' };
const review = {
  transactionXdrBase64: 'UNSIGNED',
  networkId: account.networkId,
  source: account.address,
  destination: account.address,
  sourceAsset: { kind: 'native' },
  destinationAsset: issued,
  quotedSourceAmount: '5.0000000',
  quotedDestinationAmount: '10.0000000',
  path: [issued],
  quote: { request: { mode: 'strict_send' } },
  mode: 'strict_send',
  sendAmount: '5.0000000',
  destinationMinimum: '9.9000000',
  slippageBps: 100,
  fee: '100',
  expiresAtUnixSeconds: 1782000180,
} as unknown as PreparedPathPaymentReview;

type NodeProps = Readonly<{ children?: React.ReactNode; value?: string; label?: string; onPress?: () => void }>;
function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, item => visit(item, callback));
}
function render(overrides: Partial<React.ComponentProps<typeof SwapPreviewScreen>> = {}) {
  stateCursor = 0;
  refCursor = 0;
  return SwapPreviewScreen({
    account,
    active: true,
    selectedAccountId: account.id,
    dependencies: {} as never,
    captureSession: () => () => true,
    onDone: jest.fn(),
    ...overrides,
  });
}
beforeEach(() => {
  stateSlots.length = 0;
  refSlots.length = 0;
});

describe('Swap Preview user-visible scope', () => {
  it('shows the disabled-execution disclosure and only a quote action in the form', () => {
    render();
    stateSlots[0].current = [{ kind: 'native' }, issued];
    stateSlots[1].current = false;
    stateSlots[6].current = '5';
    const root = render();
    const buttons: string[] = [];
    const texts: unknown[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.type === Text) texts.push(node.props.children);
    });
    expect(buttons).toContain('swap.preview.getQuotes');
    expect(buttons).not.toContain('swap.preview.review');
    expect(texts).toContain('swap.preview.unsignable');
  });

  it('shows full issuer identity, fixed side, protection bound and no signing/submit action in exact-XDR review', () => {
    render();
    stateSlots[0].current = [{ kind: 'native' }, issued];
    stateSlots[1].current = false;
    stateSlots[8].current = { kind: 'review', review };
    const root = render();
    const buttons: string[] = [];
    const texts: unknown[] = [];
    const values: string[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.type === Text) texts.push(node.props.children);
      if (typeof node.props.value === 'string') values.push(node.props.value);
    });
    expect(buttons).toContain('swap.preview.done');
    expect(buttons).not.toContain('swap.preview.review');
    expect(buttons).not.toContain('swap.preview.getQuotes');
    expect(texts).toContain('swap.preview.reviewOnly');
    expect(values).toContain('USD · GISSUER');
    expect(values).toContain('9.9000000');
    expect(values).toContain('100');
  });

  it('does not show form or review actions when the external selected account differs', () => {
    const root = render({ selectedAccountId: 'other' });
    const buttons: string[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
    });
    expect(buttons).toEqual(['common.back']);
  });
});
