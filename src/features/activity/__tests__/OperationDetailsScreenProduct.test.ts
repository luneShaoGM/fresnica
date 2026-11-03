jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { HistoryProductDependencies } from '../../../capabilities/history/HistoryCacheHydration';
import { claimPredicateSummary } from '../claimPredicateSummary';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import {
  contractRecord,
  transfer,
  contractId,
  source,
} from '../../../capabilities/history/__tests__/contractHistory.fixtures';
import type { HistoryClaimPredicate } from '../../../capabilities/history/types';
import type { HistoryEntry } from '../../../capabilities/history/types';
import { createLocalization } from '../../../locale/localization';
import { ParticipantCard } from '../../contacts/ParticipantCard';
import type { ContactBook } from '../../contacts/contactBook';
import { StateView } from '../../../ui/components';
import { defaultTheme } from '../../../ui/theme';
import { OperationDetailsScreen, OperationExplorerAction } from '../OperationDetailsScreen';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: jest.fn(),
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => ({ current: initial }),
    useState: jest.fn(),
  };
});

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => {
  const actual = jest.requireActual('../../../locale/localization') as typeof import('../../../locale/localization');
  return {
    useLocalization: () => actual.createLocalization('en'),
  };
});

const mockedUseState = useState as unknown as jest.Mock;
const mockedUseEffect = useEffect as unknown as jest.Mock;

const now = new Date('2026-09-21T00:00:00.000Z');
const account: AccountRecord = {
  id: 'account-a',
  address: 'GACCOUNT-A',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Primary',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};
const dependencies = {
  now: () => now,
} as unknown as HistoryProductDependencies;
const transactionHash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
const trustedUrl = `https://stellar.expert/explorer/testnet/tx/${transactionHash}`;

function unsupported(reason: 'operation-type' | 'operation-shape' = 'operation-type'): HistoryEntry {
  return {
    id: 'operation-1',
    pagingToken: 'operation-1',
    operationType: reason === 'operation-type' ? 'future_operation' : 'payment',
    occurredAt: '2026-09-21T00:00:00Z',
    transactionHash,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason,
  };
}

type NodeProps = Readonly<{
  address?: string;
  memo?: unknown;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityLiveRegion?: string;
  accessibilityRole?: string;
  accessibilityState?: Readonly<{ busy?: boolean; disabled?: boolean }>;
  actionLabel?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  failed?: boolean;
  message?: string;
  onAction?: () => void;
  onOpen?: () => void;
  opening?: boolean;
  title?: string;
  visible?: boolean;
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function findElement(
  root: React.ReactNode,
  predicate: (element: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps> | undefined {
  let match: React.ReactElement<NodeProps> | undefined;
  visit(root, element => {
    if (!match && predicate(element)) match = element;
  });
  return match;
}

function renderWithState(
  loadState: unknown,
  explorerState: 'idle' | 'opening' | 'failed' = 'idle',
  openExternalUrl: (url: string) => Promise<void> = jest.fn(async () => undefined),
  projectExplorerUrl: jest.Mock<string | undefined, [string]> = jest.fn((_transactionHash: string) => trustedUrl),
  contacts?: ContactBook,
) {
  const loadSetter = jest.fn();
  const explorerSetter = jest.fn();
  let stateCall = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const result = stateCall === 0 ? [loadState, loadSetter] : [explorerState ?? initial, explorerSetter];
    stateCall += 1;
    return result;
  });

  const root = OperationDetailsScreen({
    account,
    contacts,
    operationId: 'operation-1',
    dependencies,
    active: true,
    invalidationRevision: 0,
    onBack: jest.fn(),
    openExternalUrl,
    projectExplorerUrl,
  });

  return { root, explorerSetter, projectExplorerUrl };
}

describe('OperationDetailsScreen product hardening', () => {
  beforeEach(() => {
    mockedUseState.mockReset();
    mockedUseEffect.mockReset();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('projects the ready transaction hash and exposes the explorer action', () => {
    const entry = unsupported();
    const { root, projectExplorerUrl } = renderWithState({
      kind: 'loaded',
      result: { status: 'ready', entry },
      source: 'online',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });

    const action = findElement(root, element => element.type === OperationExplorerAction);

    expect(projectExplorerUrl).toHaveBeenCalledWith(transactionHash);
    expect(action?.props).toMatchObject({
      visible: true,
      opening: false,
      failed: false,
    });
  });

  it('hides the explorer action when Network Capability returns no trusted projection', () => {
    const projectExplorerUrl = jest.fn<string | undefined, [string]>(() => undefined);
    const { root } = renderWithState(
      {
        kind: 'loaded',
        result: { status: 'ready', entry: unsupported() },
        source: 'online',
        stale: false,
        refreshing: false,
        refreshFailed: false,
      },
      'idle',
      jest.fn(async () => undefined),
      projectExplorerUrl,
    );
    const action = findElement(root, element => element.type === OperationExplorerAction);

    expect(projectExplorerUrl).toHaveBeenCalledWith(transactionHash);
    expect(action?.props.visible).toBe(false);
  });

  it('blocks duplicate external opens while the explorer action is already busy', async () => {
    const openExternalUrl = jest.fn(async () => undefined);
    const { root } = renderWithState(
      {
        kind: 'loaded',
        result: { status: 'ready', entry: unsupported() },
        source: 'online',
        stale: false,
        refreshing: false,
        refreshFailed: false,
      },
      'opening',
      openExternalUrl,
    );
    const action = findElement(root, element => element.type === OperationExplorerAction);

    await action?.props.onOpen?.();

    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('keeps explorer failure outside History state and announces localized retry copy', async () => {
    const openExternalUrl = jest.fn(async () => {
      throw new Error('os-open-failed');
    });
    const { root, explorerSetter } = renderWithState(
      {
        kind: 'loaded',
        result: { status: 'ready', entry: unsupported() },
        source: 'online',
        stale: false,
        refreshing: false,
        refreshFailed: false,
      },
      'idle',
      openExternalUrl,
    );
    const action = findElement(root, element => element.type === OperationExplorerAction);

    await action?.props.onOpen?.();

    expect(openExternalUrl).toHaveBeenCalledWith(trustedUrl);
    expect(explorerSetter).toHaveBeenNthCalledWith(1, 'opening');
    expect(explorerSetter).toHaveBeenNthCalledWith(2, 'failed');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Couldn’t open the explorer. Try again.');
  });

  it('renders localized unsupported-shape warning and keeps common detail surface ready', () => {
    const { root } = renderWithState({
      kind: 'loaded',
      result: { status: 'ready', entry: unsupported('operation-shape') },
      source: 'online',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });

    expect(
      findElement(
        root,
        element =>
          typeof element.props.children === 'string' &&
          element.props.children.includes('Details are unavailable for this operation shape'),
      ),
    ).toBeDefined();
  });

  it('keeps transport failure on the existing retryable detail state', () => {
    const { root } = renderWithState({
      kind: 'error',
      message: 'The operation could not be loaded. Check the connection and try again.',
    });
    const stateView = findElement(root, element => element.type === StateView);

    expect(stateView?.props).toMatchObject({
      title: 'Unable to load operation',
      message: 'The operation could not be loaded. Check the connection and try again.',
      actionLabel: 'Try again',
    });
  });

  it('renders accessible busy and failure states without grouping the action into one element', () => {
    const { t } = createLocalization('en');
    const styles = jest.requireActual('../OperationDetailsScreen.styles').createStyles(defaultTheme);

    const opening = OperationExplorerAction({
      visible: true,
      opening: true,
      failed: false,
      onOpen: jest.fn(),
      t,
      styles,
    });
    const openingChildren = React.Children.toArray(opening?.props.children).filter(
      React.isValidElement,
    ) as React.ReactElement<NodeProps>[];
    const openingButton = openingChildren[0];

    expect(opening?.props.accessible).toBeUndefined();
    expect(openingButton?.type).toBe(Pressable);
    expect(openingButton?.props).toMatchObject({
      accessibilityLabel: 'Opening explorer…',
      accessibilityRole: 'button',
      accessibilityState: { busy: true, disabled: true },
      disabled: true,
    });

    const failed = OperationExplorerAction({
      visible: true,
      opening: false,
      failed: true,
      onOpen: jest.fn(),
      t,
      styles,
    });
    const failedChildren = React.Children.toArray(failed?.props.children).filter(
      React.isValidElement,
    ) as React.ReactElement<NodeProps>[];
    const failedButton = failedChildren[0];
    const failureText = failedChildren[1];

    expect(failed?.props.accessible).toBeUndefined();
    expect(failedButton?.type).toBe(Pressable);
    expect(failedButton?.props).toMatchObject({
      accessibilityLabel: 'View transaction in explorer',
      accessibilityRole: 'button',
      accessibilityState: { busy: false, disabled: false },
      disabled: false,
    });
    expect(failureText?.type).toBe(Text);
    expect(failureText?.props.accessibilityLiveRegion).toBeUndefined();
    expect(failureText?.props.children).toBe('Couldn’t open the explorer. Try again.');
  });
});

it.each(['GVALID', 'CCONTRACT', 'MMUXED'])(
  'only makes exact Classic account identities actionable in Activity (%s)',
  identity => {
    const entry = { ...unsupported(), sourceAccount: identity };
    const contacts = {
      network: { id: account.networkId },
      isClassicAccountAddress: (value: string) => value === 'GVALID',
    } as unknown as ContactBook;
    const { root } = renderWithState(
      {
        kind: 'loaded',
        result: { status: 'ready', entry },
        source: 'online',
        stale: false,
        refreshing: false,
        refreshFailed: false,
      },
      'idle',
      jest.fn(),
      jest.fn<string | undefined, [string]>(() => trustedUrl),
      contacts,
    );
    const card = findElement(root, element => element.type === ParticipantCard);
    if (identity === 'GVALID') {
      expect(card?.props.address).toBe(identity);
      expect(card?.props.memo).toBeUndefined();
    } else expect(card).toBeUndefined();
  },
);

it('exposes both exact path legs, issuers and explicit muxed participant identities', () => {
  mockedUseState.mockReset();
  const entry: HistoryEntry = {
    ...unsupported(),
    kind: 'path-payment',
    successful: true,
    operationType: 'path_payment_strict_receive',
    direction: 'outgoing',
    sourceAmount: '922337203685.4775807',
    sourceAsset: { kind: 'credit', code: 'USD', issuer: 'GSOURCEISSUER' },
    destinationAmount: '0.0000001',
    destinationAsset: { kind: 'credit', code: 'EUR', issuer: 'GDESTISSUER' },
    counterparty: 'MDESTINATION',
    participants: [
      { role: 'sender', identity: 'MSENDER', baseAccount: 'GSOURCE' },
      { role: 'recipient', identity: 'MDESTINATION', baseAccount: 'GDESTINATION' },
    ],
  };
  const { root } = renderWithState({
    kind: 'loaded',
    result: { status: 'ready', entry },
    source: 'online',
    stale: false,
    refreshing: false,
    refreshFailed: false,
  });
  const values: string[] = [];
  visit(root, element => {
    const props = element.props as Readonly<{ label?: string; value?: string }>;
    if (props.value) values.push(props.value);
    if (props.label) values.push(props.label);
  });
  expect(values).toEqual(
    expect.arrayContaining([
      'Actually sent',
      '922,337,203,685.4775807 USD',
      'Actually received',
      '0.0000001 EUR',
      'GSOURCEISSUER',
      'GDESTISSUER',
      'Outgoing',
    ]),
  );
  // ParticipantRows receives full display identities; the base is never used for contact selection.
  const participantRows = findElement(root, element => 'participants' in element.props);
  const props = participantRows?.props as unknown as { participants: readonly { identity: string }[] };
  expect(props.participants.map(participant => participant.identity)).toEqual(['MSENDER', 'MDESTINATION']);
});

it.each(['manage_buy_offer', 'manage_sell_offer', 'create_passive_sell_offer'])(
  'denominates %s order quantity explicitly without implying settlement',
  operationType => {
    mockedUseState.mockReset();
    const entry: HistoryEntry = {
      ...unsupported(),
      kind: 'offer',
      successful: true,
      operationType,
      buyingAsset: { kind: 'credit', code: 'USD', issuer: 'GBUYISSUER' },
      sellingAsset: { kind: 'native', code: 'XLM' },
      amount: '922337203685.4775807',
      price: { n: 2147483647, d: 3 },
      offerId: '9223372036854775807',
      cancellation: false,
    };
    const { root } = renderWithState({
      kind: 'loaded',
      result: { status: 'ready', entry },
      source: 'online',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });
    const values: string[] = [];
    visit(root, element => {
      const props = element.props as Readonly<{ label?: string; value?: string; children?: unknown }>;
      if (props.label) values.push(props.label);
      if (props.value) values.push(props.value);
      if (typeof props.children === 'string') values.push(props.children);
    });
    expect(values).toEqual(
      expect.arrayContaining([
        'Order quantity',
        `922,337,203,685.4775807 ${operationType === 'manage_buy_offer' ? 'USD' : 'XLM'}`,
        'Buying asset',
        'Selling asset',
        'GBUYISSUER',
        'Order price',
        '2147483647/3',
        '9223372036854775807',
        'Order quantity is an instruction. It does not prove executed volume or the remaining order state.',
      ]),
    );
    expect(values).not.toContain('Direction');
  },
);
it.each(['liquidity_pool_deposit', 'liquidity_pool_withdraw'])(
  'exposes %s actual ordered reserves, full issuers, pool ID and shares',
  operationType => {
    mockedUseState.mockReset();
    const entry: HistoryEntry = {
      ...unsupported(),
      kind: 'liquidity-pool',
      successful: true,
      operationType,
      poolId: 'a'.repeat(64),
      shares: '0.0000001',
      reserves: [
        { asset: { kind: 'native', code: 'XLM' }, amount: '0' },
        { asset: { kind: 'credit', code: 'USD', issuer: 'GRESERVEISSUER' }, amount: '922337203685.4775807' },
      ],
    };
    const { root } = renderWithState({
      kind: 'loaded',
      result: { status: 'ready', entry },
      source: 'online',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });
    const values: string[] = [];
    visit(root, element => {
      const props = element.props as Readonly<{ label?: string; value?: string }>;
      if (props.label) values.push(props.label);
      if (props.value) values.push(props.value);
    });
    expect(values).toEqual(
      expect.arrayContaining([
        'Pool ID',
        'a'.repeat(64),
        '0 XLM',
        '922,337,203,685.4775807 USD',
        'GRESERVEISSUER',
        '0.0000001',
        operationType === 'liquidity_pool_deposit' ? 'Shares received' : 'Shares redeemed',
      ]),
    );
  },
);

it.each(['create', 'claim', 'clawback', 'clawback-reference'])(
  'renders %s historical evidence and localized warnings without claim/burn actions',
  family => {
    mockedUseState.mockReset();
    let entry: HistoryEntry;
    if (family === 'create')
      entry = {
        ...unsupported(),
        kind: 'claimable-create',
        successful: true,
        operationType: 'create_claimable_balance',
        asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
        amount: '922337203685.4775807',
        role: 'claimant',
        claimants: [
          {
            destination: 'GCLAIMANT',
            predicate: { and: [{ abs_before: '+39121901036-03-29T15:30:22Z' }, { rel_before: '-1' }] },
          },
        ],
      };
    else if (family === 'clawback')
      entry = {
        ...unsupported(),
        kind: 'clawback',
        successful: true,
        operationType: 'clawback',
        asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
        amount: '0',
        role: 'holder',
        holder: 'MMUXEDHOLDER',
        holderBase: 'GBASEHOLDER',
      };
    else
      entry = {
        ...unsupported(),
        kind: 'claimable-reference',
        successful: true,
        operationType: family === 'claim' ? 'claim_claimable_balance' : 'clawback_claimable_balance',
        balanceId: `00000000${'a'.repeat(64)}`,
      };
    const { root } = renderWithState({
      kind: 'loaded',
      result: { status: 'ready', entry },
      source: 'online',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });
    const values: string[] = [];
    visit(root, element => {
      const props = element.props as Readonly<{ label?: string; value?: string; children?: unknown }>;
      if (props.label) values.push(props.label);
      if (props.value) values.push(props.value);
      if (typeof props.children === 'string') values.push(props.children);
    });
    if (family === 'create') {
      expect(values).toEqual(
        expect.arrayContaining([
          'Claimable quantity',
          'Creator',
          'Claimant',
          'GCLAIMANT',
          '922,337,203,685.4775807 USD',
        ]),
      );
      expect(values.some(value => value.includes('+39121901036-03-29T15:30:22Z') && value.includes('-1'))).toBe(true);
      expect(values).toContain(
        'This historical creation record does not establish current claim eligibility or whether the balance is still available.',
      );
    } else if (family === 'clawback') {
      expect(values).toEqual(
        expect.arrayContaining([
          'Quantity removed',
          'Holder',
          'MMUXEDHOLDER',
          'Holder base account',
          'GBASEHOLDER',
          '0 USD',
        ]),
      );
    } else {
      expect(values).toContain(`00000000${'a'.repeat(64)}`);
      expect(values).toContain(
        'This operation records the balance ID only. Its historical asset and quantity are unavailable without additional ledger evidence.',
      );
    }
    if (family.includes('clawback'))
      expect(values).toContain('The issuer removed and burned these tokens. They were not paid to the issuer.');
    expect(values).not.toContain('Claim now');
    expect(values).not.toContain('Direction');
  },
);

it('wraps the complete depth-four condition structure without changing other detail line limits', () => {
  mockedUseState.mockReset();
  let predicate: HistoryClaimPredicate = { abs_before: '+292277026596-12-04T15:30:22.1234567Z' };
  for (let depth = 0; depth < 4; depth += 1) predicate = { and: [predicate, predicate] };
  const entry: HistoryEntry = {
    ...unsupported(),
    kind: 'claimable-create',
    successful: true,
    operationType: 'create_claimable_balance',
    asset: { kind: 'native', code: 'XLM' },
    amount: '1',
    role: 'claimant',
    claimants: [{ destination: 'GCLAIMANT', predicate }],
  };
  const { root } = renderWithState({
    kind: 'loaded',
    result: { status: 'ready', entry },
    source: 'online',
    stale: false,
    refreshing: false,
    refreshFailed: false,
  });
  const { t } = createLocalization('en');
  const summary = claimPredicateSummary(predicate, t);
  expect(summary.length).toBeGreaterThan(1000);
  const renderDetail = (label: string) => {
    const row = findElement(root, element => (element.props as { label?: string }).label === label);
    if (!row || typeof row.type !== 'function') throw new Error('expected-detail-row');
    const component = row.type as (props: NodeProps) => React.ReactNode;
    return component(row.props);
  };
  const condition = renderDetail('Recorded condition');
  const value = findElement(condition, element => element.type === Text && element.props.children === summary);
  expect(value?.props.children).toBe(summary);
  expect((value?.props as { numberOfLines?: number }).numberOfLines).toBeUndefined();
  const other = renderDetail('Operation type');
  const otherValue = findElement(
    other,
    element => element.type === Text && element.props.children === 'create_claimable_balance',
  );
  expect((otherValue?.props as { numberOfLines?: number }).numberOfLines).toBe(2);
});

it('shows every contract event, exact large quantities and full identities without line caps', () => {
  mockedUseState.mockReset();
  const entry = mapHistoryEntry(
    contractRecord({
      assetBalanceChanges: [
        { ...transfer, amount: '17014118346046923173168730371588.4105727', to: contractId },
        { ...transfer, type: 'mint', from: '', amount: '2', to: source },
        { ...transfer, type: 'burn', to: '', amount: '3' },
        { ...transfer, destinationMuxedId: '42', amount: '4' },
      ],
    }),
    source,
  );
  const { root } = renderWithState({
    kind: 'loaded',
    result: { status: 'ready', entry },
    source: 'online',
    stale: false,
    refreshing: false,
    refreshFailed: false,
  });
  const values: string[] = [];
  let eventCount = 0;
  visit(root, element => {
    const props = element.props as { label?: string; value?: string; children?: unknown; fullValue?: boolean };
    if (props.label) values.push(props.label);
    if (props.value) values.push(props.value);
    if (typeof props.children === 'string') values.push(props.children);
    if (props.label === 'Asset event') eventCount += 1;
    if (props.label === 'Reported quantity' || props.label === 'Contract ID') {
      expect(props.fullValue).toBe(true);
      if (typeof element.type !== 'function') throw new Error('expected-detail-row');
      const rendered = (element.type as (input: NodeProps) => React.ReactNode)(element.props);
      const text = findElement(rendered, child => child.type === Text && child.props.children === props.value);
      expect((text?.props as { numberOfLines?: number }).numberOfLines).toBeUndefined();
    }
  });
  expect(eventCount).toBe(4);
  expect(values).toEqual(
    expect.arrayContaining([
      contractId,
      'Transfer',
      'Mint',
      'Burn',
      '42',
      '17,014,118,346,046,923,173,168,730,371,588.4105727 XLM',
      '4 XLM',
    ]),
  );
  expect(values).toContain('Destination routing ID (not a Memo)');
});
