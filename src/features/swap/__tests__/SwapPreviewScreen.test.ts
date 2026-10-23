import React from 'react';
import { Text } from 'react-native';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { PathPaymentQuote, PreparedPathPaymentReview } from '../../../capabilities/path-payment/types';
import { NativeButton } from '../../../ui/components/NativeButton';
import { SlideToConfirm } from '../../../ui/SlideToConfirm';
import { SwapPassphraseInput } from '../SwapPassphraseInput';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
jest.mock('../swapSubmissionProductFlow', () => ({
  submitSwapReview: jest.fn(),
  listSwapHistory: jest.fn(() => []),
  reconcileSwapPending: jest.fn(),
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
const { submitSwapReview, listSwapHistory } = require('../swapSubmissionProductFlow') as jest.Mocked<
  typeof import('../swapSubmissionProductFlow')
>;
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
const assetOptions = [
  { asset: { kind: 'native' as const }, balance: '20.0000000', spendable: '17.4999900' },
  { asset: issued, balance: '10.0000000', spendable: '10.0000000' },
];
const quote: PathPaymentQuote = {
  request: {
    network: { id: account.networkId } as never,
    source: account.address,
    destination: account.address,
    sourceAsset: { kind: 'native' },
    destinationAsset: issued,
    mode: 'strict_send',
    fixedAmount: '5.0000000',
  },
  sourceAmount: '5.0000000',
  destinationAmount: '10.0000000',
  path: [issued],
  quotedAtUnixMs: 1782000000000,
  expiresAtUnixMs: 1782000030000,
  quotedAtMonotonicMs: 1000,
};
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

type NodeProps = Readonly<{
  children?: React.ReactNode;
  value?: string;
  label?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  onComplete?: () => void;
  onChangeAmount?: (value: string) => void;
  onMax?: () => void;
  onOpenAssets?: () => void;
  onSelect?: (index: number) => void;
  secureTextEntry?: boolean;
  disabled?: boolean;
}>;
type SettingsModalProps = Readonly<{
  allowIntermediatePaths: boolean;
  onDone: () => void;
  onSelectRoute: (selected: PathPaymentQuote) => void;
  onSelectSlippage: (value: string) => void;
  onToggleIntermediate: () => void;
  onUpdateSlippage: (value: string) => void;
  routes: readonly PathPaymentQuote[];
  selectedQuote: PathPaymentQuote | undefined;
  slippageDraft: string;
}>;
function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, item => visit(item, callback));
}

function elementsNamed(node: React.ReactNode, name: string): React.ReactElement<NodeProps>[] {
  const matches: React.ReactElement<NodeProps>[] = [];
  visit(node, element => {
    if (typeof element.type === 'function' && element.type.name === name) matches.push(element);
  });
  return matches;
}
function render(overrides: Partial<React.ComponentProps<typeof SwapPreviewScreen>> = {}) {
  stateCursor = 0;
  refCursor = 0;
  return SwapPreviewScreen({
    account,
    active: true,
    selectedAccountId: account.id,
    dependencies: {} as never,
    execution: {} as never,
    captureSession: () => () => true,
    openExternalUrl: jest.fn(async () => undefined),
    onManageAssets: jest.fn(),
    onDone: jest.fn(),
    ...overrides,
  });
}
beforeEach(() => {
  stateSlots.length = 0;
  refSlots.length = 0;
  submitSwapReview.mockReset();
  listSwapHistory.mockReset().mockReturnValue([]);
});

describe('Swap Preview user-visible scope', () => {
  it('shows both editable asset surfaces without a manual quote action', () => {
    render();
    stateSlots[0].current = assetOptions;
    stateSlots[1].current = false;
    stateSlots[6].current = '5';
    const root = render();
    const buttons: string[] = [];
    const accessibilityLabels: string[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.props.accessibilityLabel) accessibilityLabels.push(node.props.accessibilityLabel);
    });
    expect(buttons).not.toContain('swap.preview.getQuotes');
    expect(buttons).not.toContain('swap.preview.review');
    expect(accessibilityLabels).toContain('swap.form.exchangeAssets');
  });

  it('keeps a one-asset account on a useful Add Asset state instead of a blank retry screen', () => {
    const onManageAssets = jest.fn();
    render({ onManageAssets });
    stateSlots[0].current = [assetOptions[0]];
    stateSlots[1].current = false;
    const buttons: React.ReactElement<NodeProps>[] = [];
    visit(render({ onManageAssets }), node => {
      if (node.type === NativeButton) buttons.push(node);
    });
    const addAsset = buttons.find(button => button.props.label === 'swap.assets.add');
    expect(addAsset).toBeDefined();
    addAsset?.props.onPress?.();
    expect(onManageAssets).toHaveBeenCalledTimes(1);
  });

  it('uses conservative Max and makes the last edited amount side authoritative', () => {
    render();
    stateSlots[0].current = assetOptions;
    stateSlots[1].current = false;
    const cards = elementsNamed(render(), 'SwapAssetCard');
    expect(cards).toHaveLength(2);
    cards[0].props.onMax?.();
    expect(stateSlots[5].current).toBe('strict_send');
    expect(stateSlots[6].current).toBe('17.4999900');
    cards[1].props.onChangeAmount?.('9');
    expect(stateSlots[5].current).toBe('strict_receive');
    expect(stateSlots[6].current).toBe('');
    expect(stateSlots[7].current).toBe('9');

    stateSlots[14].current = true;
    const quotingCards = elementsNamed(render(), 'SwapAssetCard');
    expect(quotingCards[0].props.disabled).toBe(false);
    quotingCards[0].props.onChangeAmount?.('12');
    expect(stateSlots[14].current).toBe(false);
    expect(stateSlots[6].current).toBe('12');
  });

  it('exchanges both asset sides and prevents selecting the same asset on both sides', () => {
    render();
    stateSlots[0].current = assetOptions;
    stateSlots[1].current = false;
    stateSlots[6].current = '5';
    stateSlots[7].current = '9';
    let exchange: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.props.accessibilityLabel === 'swap.form.exchangeAssets') exchange = node;
    });
    exchange?.props.onPress?.();
    expect(stateSlots[3].current).toBe(1);
    expect(stateSlots[4].current).toBe(0);
    expect(stateSlots[6].current).toBe('');
    expect(stateSlots[7].current).toBe('');

    const sourceCard = elementsNamed(render(), 'SwapAssetCard')[0];
    sourceCard.props.onOpenAssets?.();
    const picker = elementsNamed(render(), 'AssetPickerModal')[0];
    picker.props.onSelect?.(0);
    expect(stateSlots[3].current).toBe(0);
    expect(stateSlots[4].current).toBe(1);
  });

  it('opens Stellar-style settings over quotes and applies per-mille presets without retaining stale quotes', () => {
    render();
    stateSlots[0].current = assetOptions;
    stateSlots[1].current = false;
    stateSlots[6].current = '5';
    stateSlots[7].current = '10';
    stateSlots[12].current = { kind: 'quotes', quotes: [quote], selected: quote };
    let settingsAction: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.props.accessibilityLabel === 'swap.settings.title') settingsAction = node;
    });
    settingsAction?.props.onPress?.();
    expect(stateSlots[10].current).toBe(true);
    expect(stateSlots[22].current).toBe('5');

    const modal = elementsNamed(render(), 'SwapSettingsModal')[0] as unknown as React.ReactElement<SettingsModalProps>;
    expect(modal.props.allowIntermediatePaths).toBe(true);
    expect(modal.props.routes).toEqual([quote]);
    expect(modal.props.selectedQuote).toBe(quote);
    expect(modal.props.slippageDraft).toBe('5');

    modal.props.onSelectSlippage('10');
    expect(stateSlots[8].current).toBe('10');
    expect(stateSlots[22].current).toBe('10');
    expect(stateSlots[12].current).toEqual({ kind: 'form' });
    expect(stateSlots[14].current).toBe(false);
  });

  it('shows exact reviewed XDR with explicit slide authorization and no tap-to-send button', () => {
    render();
    stateSlots[0].current = assetOptions;
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    const root = render();
    const buttons: string[] = [];
    const texts: unknown[] = [];
    const values: string[] = [];
    const slides: string[] = [];
    visit(root, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
      if (node.type === Text) texts.push(node.props.children);
      if (typeof node.props.value === 'string') values.push(node.props.value);
    });
    expect(slides).toEqual(['swap.execution.slide']);
    expect(buttons).not.toContain('swap.preview.done');
    expect(buttons).not.toContain('swap.preview.review');
    expect(buttons).not.toContain('swap.preview.getQuotes');
    expect(texts).toContain('swap.execution.authorizationNotice');
    expect(values).toContain('USD · GISSUER');
    expect(values).toContain('9.9000000');
    expect(values).toContain('10‰');
  });

  it('requires a secure app passphrase and another explicit slide when System Auth fallback is requested', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    stateSlots[15].current = true;
    stateSlots[16].current = true;
    const root = render();
    let secureInput: React.ReactElement<NodeProps> | undefined;
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(root, node => {
      if (node.type === SwapPassphraseInput) secureInput = node;
      if (node.type === SlideToConfirm) slide = node;
    });
    expect(secureInput).toBeDefined();
    expect(secureInput?.props.value).toBeUndefined();
    expect(stateSlots[16].current).toBe(true); // Availability only, never the password.
    expect(slide?.props.label).toBe('swap.execution.slidePassphrase');
  });

  it('shows uncertain transaction hash without offering a second submit after broadcast uncertainty', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = {
      kind: 'result',
      result: {
        status: 'uncertain',
        transactionHash: 'hash-unknown',
        reason: 'pending-reconciliation',
      },
    };
    const root = render();
    const slides: string[] = [];
    const resultView = elementsNamed(root, 'TransactionResult')[0] as unknown as React.ReactElement<{
      title: string;
      tone: string;
      details?: readonly { value: string }[];
      primaryAction: { label: string };
    }>;
    visit(root, node => {
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
    });
    expect(resultView).toBeDefined();
    expect(resultView?.props.title).toBe('swap.result.uncertain');
    expect(resultView?.props.tone).toBe('unverified');
    expect(resultView?.props.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'hash-unknown' })]),
    );
    expect(resultView?.props.primaryAction.label).toBe('swap.preview.done');
    expect(slides).toEqual([]);
  });

  it('blocks the confirmation slide while a prior same-account Swap is unresolved', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    stateSlots[18].current = [
      {
        id: 'stellar-testnet:hash-pending',
        accountId: account.id,
        networkId: account.networkId,
        sourceAddress: account.address,
        transactionHash: 'hash-pending',
        intentKind: 'path-payment',
        intentKey: 'swap:1',
        state: 'uncertain',
        updatedAt: new Date(0),
        createdAt: new Date(0),
      },
    ];
    const root = render();
    let slide: React.ReactElement<NodeProps> | undefined;
    const labels: string[] = [];
    visit(root, node => {
      if (node.type === SlideToConfirm) slide = node;
      if (node.type === NativeButton) labels.push(node.props.label ?? '');
    });
    expect(slide?.props.disabled).toBe(true);
    expect(labels).toContain('swap.history.check');
  });

  it('keeps terminal history out of the editing form and does not recreate a transaction', () => {
    render();
    stateSlots[1].current = false;
    stateSlots[18].current = [
      {
        id: 'stellar-testnet:hash-confirmed',
        accountId: account.id,
        networkId: account.networkId,
        sourceAddress: account.address,
        transactionHash: 'hash-confirmed',
        intentKind: 'path-payment',
        intentKey: 'swap:2',
        state: 'confirmed',
        updatedAt: new Date(0),
        createdAt: new Date(0),
        ledger: 74,
      },
    ];
    const root = render();
    const texts: unknown[] = [];
    const slides: string[] = [];
    visit(root, node => {
      if (node.type === Text) texts.push(node.props.children);
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
    });
    expect(texts).not.toContain('swap.history.state.confirmed');
    expect(texts).not.toContain('hash-confirmed');
    expect(slides).toEqual([]);
  });

  it('calls reviewed D1 once even if the authorization slide callback fires twice rapidly', async () => {
    submitSwapReview.mockResolvedValue({ status: 'submitted', authorization: 'system-auth', hash: 'sent-hash' });
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    const root = render();
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(root, node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    const first = slide?.props.onComplete?.();
    const second = slide?.props.onComplete?.();
    await Promise.all([first, second]);
    expect(submitSwapReview).toHaveBeenCalledTimes(1);
    expect(submitSwapReview).toHaveBeenCalledWith(expect.anything(), account, review, expect.any(Function), undefined);
    expect(stateSlots[12].current).toMatchObject({
      kind: 'result',
      result: { status: 'submitted', hash: 'sent-hash' },
    });
  });

  it('renders the original unknown hash instead of a retryable review after a broadcast result', async () => {
    submitSwapReview.mockResolvedValueOnce({
      status: 'uncertain',
      transactionHash: 'HASH_FROM_ORIGINAL_BROADCAST',
    });
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    await slide?.props.onComplete?.();
    expect(stateSlots[12].current).toMatchObject({
      kind: 'result',
      result: { status: 'uncertain', transactionHash: 'HASH_FROM_ORIGINAL_BROADCAST' },
    });
    const slides: string[] = [];
    const shown = render();
    visit(shown, node => {
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
    });
    const result = elementsNamed(shown, 'TransactionResult')[0] as unknown as React.ReactElement<{
      details?: readonly { value: string }[];
    }>;
    expect(result?.props.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: 'HASH_FROM_ORIGINAL_BROADCAST' })]),
    );
    expect(slides).toEqual([]);
    expect(submitSwapReview).toHaveBeenCalledTimes(1);
  });

  it('still offers original-hash check-only recovery if the post-broadcast Realm read fails', async () => {
    submitSwapReview.mockResolvedValueOnce({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH' });
    listSwapHistory.mockImplementationOnce(() => {
      throw new Error('realm-read-failed');
    });
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    await slide?.props.onComplete?.();
    const buttons: string[] = [];
    const slides: string[] = [];
    const shown = render();
    visit(shown, node => {
      if (node.type === NativeButton) buttons.push(node.props.label ?? '');
      if (node.type === SlideToConfirm) slides.push(node.props.label ?? '');
    });
    const result = elementsNamed(shown, 'TransactionResult')[0] as unknown as React.ReactElement<{
      actions?: readonly { label: string }[];
    }>;
    expect(stateSlots[12].current).toMatchObject({
      kind: 'result',
      result: { status: 'uncertain', transactionHash: 'ORIGINAL_HASH' },
    });
    expect(slides).toEqual([]);
    expect(result?.props.actions?.map(action => action.label)).toContain('swap.history.check');
    expect(buttons).not.toContain('swap.preview.review');
  });

  it('keeps the same reviewed transaction across System Auth fallback and a second explicit slide', async () => {
    submitSwapReview
      .mockResolvedValueOnce({ status: 'passphrase-required' })
      .mockResolvedValueOnce({ status: 'submitted', authorization: 'passphrase', hash: 'signed-hash' });
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    await slide?.props.onComplete?.();
    expect(stateSlots[15].current).toBe(true);
    const consume = jest.fn(() => 'password');
    const clear = jest.fn();
    refSlots[5].current = { consume, clear };
    stateSlots[16].current = true;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    expect(slide?.props.label).toBe('swap.execution.slidePassphrase');
    await slide?.props.onComplete?.();
    expect(submitSwapReview).toHaveBeenCalledTimes(2);
    expect(submitSwapReview).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      account,
      review,
      expect.any(Function),
      undefined,
    );
    expect(submitSwapReview).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      account,
      review,
      expect.any(Function),
      'password',
    );
    expect(consume).toHaveBeenCalledTimes(1);
    expect(stateSlots[16].current).toBe(false);
    expect(stateSlots.map(slot => slot.current)).not.toContain('password');
    expect(stateSlots[12].current).toMatchObject({ kind: 'result', result: { status: 'submitted' } });
  });

  it('never mislabels an accepted broadcast as a submission error when local history reading fails', async () => {
    submitSwapReview.mockResolvedValue({ status: 'submitted', authorization: 'system-auth', hash: 'confirmed-hash' });
    listSwapHistory.mockImplementationOnce(() => {
      throw new Error('realm-read-unavailable');
    });
    render();
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    let slide: React.ReactElement<NodeProps> | undefined;
    visit(render(), node => {
      if (node.type === SlideToConfirm) slide = node;
    });
    await slide?.props.onComplete?.();
    expect(stateSlots[12].current).toMatchObject({
      kind: 'result',
      result: { status: 'submitted', hash: 'confirmed-hash' },
    });
    expect(stateSlots[13].current).toBeUndefined();
    expect(stateSlots[19].current).toBe('swap.error.historyUnavailable');
  });

  it('returns from review to the swap form and clears the transient input', () => {
    const onDone = jest.fn();
    const clear = jest.fn();
    render({ onDone });
    refSlots[5].current = { clear, consume: jest.fn() };
    stateSlots[1].current = false;
    stateSlots[12].current = { kind: 'review', review };
    let back: React.ReactElement<NodeProps> | undefined;
    visit(render({ onDone }), node => {
      if (node.type === NativeButton && node.props.label === 'common.back') back ??= node;
    });
    back?.props.onPress?.();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
    expect(stateSlots[12].current).toEqual({ kind: 'form' });
    expect(stateSlots[16].current).toBe(false);
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
