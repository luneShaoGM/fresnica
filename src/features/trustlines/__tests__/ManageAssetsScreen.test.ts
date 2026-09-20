import React, { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, type ViewStyle } from 'react-native';

import type { AccountRecord } from '../../../capabilities/account/types';
import { loadBalanceSnapshot } from '../../../capabilities/balance/loadBalanceSnapshot';
import type { TrustlineReview } from '../../../capabilities/trustline/buildTrustlineReview';
import { SlideToConfirm } from '../../../ui/SlideToConfirm';
import { defaultTheme } from '../../../ui/theme';
import { ManageAssetsScreen } from '../ManageAssetsScreen';
import { createManageAssetsStyles } from '../styles';
import {
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
  type TrustlineSubmissionResult,
} from '../trustlineProductFlow';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: jest.fn(),
    useRef: (initial: unknown) => ({ current: initial }),
    useState: jest.fn(),
  };
});

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => {
  const actual = jest.requireActual('../../../locale/localization') as typeof import('../../../locale/localization');
  return {
    useLocalization: () => actual.createLocalization('en'),
  };
});

jest.mock('../../../capabilities/balance/loadBalanceSnapshot', () => ({
  loadBalanceSnapshot: jest.fn(),
}));

jest.mock('../trustlineProductFlow', () => {
  const actual = jest.requireActual('../trustlineProductFlow') as typeof import('../trustlineProductFlow');
  return {
    ...actual,
    submitTrustlineProductReview: jest.fn(),
  };
});

const mockedUseState = useState as unknown as jest.Mock;
const mockedLoadBalanceSnapshot = loadBalanceSnapshot as jest.MockedFunction<typeof loadBalanceSnapshot>;
const mockedSubmitTrustlineProductReview = submitTrustlineProductReview as jest.MockedFunction<
  typeof submitTrustlineProductReview
>;

const now = new Date('2026-09-18T00:00:00.000Z');
const account: AccountRecord = {
  id: 'account-a',
  address: 'GSOURCE',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Primary',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};

const dependencies = {
  gateway: {},
  sdk: {},
  repository: {},
  recovery: {},
  network: {
    id: 'stellar-testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
} as unknown as TrustlineProductDependencies;

const readyLoadState = {
  kind: 'ready' as const,
  trustlines: [
    {
      asset: { kind: 'credit' as const, code: 'USD', issuer: 'GISSUER' },
      balance: '2.5000000',
      limit: '1000.0000000',
    },
  ],
};

const review: TrustlineReview = {
  transactionXdrBase64: 'AAAA',
  networkId: 'stellar-testnet',
  source: 'GSOURCE',
  fee: '100',
  operation: 'set-limit',
  asset: { code: 'USD', issuer: 'GISSUER' },
  limit: '1200.0000000',
  expectedAuthorization: 'full',
  expectedClawbackEnabled: false,
};

type StateOverrides = Readonly<{
  loadState?: unknown;
  flow?: unknown;
  assetCode?: string;
  assetIssuer?: string;
  limitEditor?: unknown;
  building?: boolean;
  submitting?: boolean;
  passphraseRequired?: boolean;
  appPassphrase?: string;
  error?: string;
}>;

type NodeProps = Readonly<{
  children?: React.ReactNode;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityLiveRegion?: string;
  accessibilityRole?: string;
  accessibilityState?: Readonly<{ disabled?: boolean }>;
  actionLabel?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  importantForAutofill?: string;
  label?: string;
  loading?: boolean;
  loadingLabel?: string;
  onAction?: () => void;
  onComplete?: () => void;
  onPress?: () => void;
  placeholder?: string;
  spellCheck?: boolean;
  value?: string;
}>;

function renderWithState(overrides: StateOverrides = {}) {
  const setters = Array.from({ length: 10 }, () => jest.fn());
  const values = [
    overrides.loadState ?? readyLoadState,
    overrides.flow ?? { kind: 'manage' },
    overrides.assetCode ?? '',
    overrides.assetIssuer ?? '',
    overrides.limitEditor,
    overrides.building ?? false,
    overrides.submitting ?? false,
    overrides.passphraseRequired ?? false,
    overrides.appPassphrase ?? '',
    overrides.error,
  ];

  let call = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const index = call;
    call += 1;
    return [values[index] === undefined ? initial : values[index], setters[index]];
  });

  return {
    root: ManageAssetsScreen({
      account,
      dependencies,
      onDone: jest.fn(),
    }),
    setters,
  };
}

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function elementsWithLabel(root: React.ReactNode, label: string): React.ReactElement<NodeProps>[] {
  const matches: React.ReactElement<NodeProps>[] = [];
  visit(root, element => {
    if (element.props.accessibilityLabel === label) matches.push(element);
  });
  return matches;
}

function renderedText(root: React.ReactNode): string[] {
  const values: string[] = [];
  const collect = (node: React.ReactNode): void => {
    if (typeof node === 'string' || typeof node === 'number') {
      values.push(String(node));
      return;
    }
    if (!React.isValidElement<NodeProps>(node)) return;
    React.Children.forEach(node.props.children, collect);
  };
  collect(root);
  return values;
}

describe('ManageAssetsScreen Stage 4 hardening', () => {
  beforeEach(() => {
    mockedUseState.mockReset();
    mockedLoadBalanceSnapshot.mockReset();
    mockedSubmitTrustlineProductReview.mockReset();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes a localized retry after load failure and retries the authoritative balance path', async () => {
    mockedLoadBalanceSnapshot.mockRejectedValue(new Error('offline'));
    const { root, setters } = renderWithState({ loadState: { kind: 'error' } });

    expect(root.props.actionLabel).toBe('Retry');
    expect(typeof root.props.onAction).toBe('function');

    root.props.onAction?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockedLoadBalanceSnapshot).toHaveBeenCalledWith(
      { gateway: dependencies.gateway, networkId: 'stellar-testnet' },
      account,
    );
    expect(setters[0]).toHaveBeenNthCalledWith(1, { kind: 'loading' });
    expect(setters[0]).toHaveBeenLastCalledWith({ kind: 'error' });
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Unable to load trustlines. Retry is available.',
    );
  });

  it('localizes Add, Set Limit and Remove controls with explicit accessibility contracts', () => {
    const { root } = renderWithState({
      limitEditor: {
        code: 'USD',
        issuer: 'GISSUER',
        currentLimit: '1000.0000000',
        value: '1200.0000000',
      },
    });

    const add = elementsWithLabel(root, 'Review add')[0];
    const setLimit = elementsWithLabel(root, 'Set limit for USD')[0];
    const remove = elementsWithLabel(root, 'Remove USD trustline')[0];
    const reviewLimit = elementsWithLabel(root, 'Review limit')[0];
    const limitInput = elementsWithLabel(root, 'New USD trustline limit')[0];
    const codeInput = elementsWithLabel(root, 'Asset code')[0];
    const issuerInput = elementsWithLabel(root, 'Issuer')[0];

    expect(add?.type).toBe(Pressable);
    expect(add?.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityState: { disabled: true },
      disabled: true,
    });
    expect(setLimit?.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityState: { disabled: false },
    });
    expect(remove?.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityState: { disabled: false },
    });
    expect(reviewLimit?.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityState: { disabled: false },
    });
    expect(limitInput?.type).toBe(TextInput);
    expect(limitInput?.props.placeholder).toBe('New positive limit');
    expect(codeInput?.type).toBe(TextInput);
    expect(issuerInput?.type).toBe(TextInput);
  });

  it('renders the localized App Passphrase fallback with focus, hint and a disabled second slide', () => {
    const { root } = renderWithState({
      flow: { kind: 'review', review },
      passphraseRequired: true,
      appPassphrase: '',
    });
    let passphraseInput: React.ReactElement<NodeProps> | undefined;
    let slider: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === TextInput && element.props.accessibilityLabel === 'App Passphrase') {
        passphraseInput = element;
      }
      if (element.type === SlideToConfirm) slider = element;
    });

    expect(passphraseInput?.props).toMatchObject({
      accessibilityHint: 'Enter the current App Passphrase to authorize this asset change.',
      autoComplete: 'off',
      autoFocus: true,
      importantForAutofill: 'no',
      placeholder: 'Current App Passphrase',
      spellCheck: false,
    });
    expect(slider?.props).toMatchObject({
      label: 'Slide to authorize change',
      loadingLabel: 'Submitting…',
      disabled: true,
      loading: false,
    });
    expect(renderedText(root)).toContain(
      'App Passphrase required. Enter it below, then slide again to authorize this asset change.',
    );
  });

  it('localizes the authorization value and Native System Auth reason', async () => {
    mockedSubmitTrustlineProductReview.mockResolvedValue({ status: 'watch-only' });
    const { root } = renderWithState({ flow: { kind: 'review', review } });
    let authorizationRow: React.ReactElement<NodeProps> | undefined;
    let slider: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.props.label === 'Expected authorization') authorizationRow = element;
      if (element.type === SlideToConfirm) slider = element;
    });

    expect(authorizationRow?.props.value).toBe('Authorized');

    slider?.props.onComplete?.();
    await Promise.resolve();

    expect(mockedSubmitTrustlineProductReview).toHaveBeenCalledWith(
      dependencies,
      account,
      review,
      'Set USD trustline limit',
      undefined,
    );
  });

  it.each<[TrustlineSubmissionResult, string, string]>([
    [
      {
        status: 'submitted',
        authorization: 'system-auth',
        hash: 'abc123',
        ledger: 456,
      },
      'Asset change submitted',
      'Accepted as abc123 in ledger 456. Return to Wallet to refresh asset state.',
    ],
    [
      {
        status: 'rejected',
        transactionHash: 'def456',
        resultCode: 'tx_bad_seq',
      },
      'Transaction rejected',
      'Horizon deterministically rejected def456 (tx_bad_seq).',
    ],
    [
      { status: 'uncertain', transactionHash: 'ghi789' },
      'Status uncertain',
      'The network outcome for ghi789 is uncertain. Verify the hash before retrying.',
    ],
  ])('renders localized %s result state', (result, expectedTitle, expectedDescription) => {
    const { root } = renderWithState({ flow: { kind: 'result', result } });
    const text = renderedText(root);
    const back = elementsWithLabel(root, 'Back to Wallet')[0];

    expect(text).toContain(expectedTitle);
    expect(text).toContain(expectedDescription);
    expect(back?.props.accessibilityRole).toBe('button');
  });

  it('uses minimum heights for localized action controls so dynamic type can expand them', () => {
    const styles = createManageAssetsStyles(defaultTheme);
    const controls = [
      styles.primaryButton,
      styles.limitButton,
      styles.removeButton,
      styles.cancelLimitButton,
      styles.reviewLimitButton,
      styles.messageAction,
    ];

    for (const style of controls) {
      const flattened = StyleSheet.flatten(style) as ViewStyle;
      expect(flattened.height).toBeUndefined();
      expect(flattened.minHeight).toBeGreaterThan(0);
    }
  });

  it('keeps inline async errors passive because failures use one proactive announcement path', () => {
    const { root } = renderWithState({ error: 'Unable to manage this asset.' });
    let error: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (element.type === Text && element.props.children === 'Unable to manage this asset.') {
        error = element;
      }
    });

    expect(error).toBeDefined();
    expect(error?.props.accessibilityLiveRegion).toBeUndefined();
  });
});
