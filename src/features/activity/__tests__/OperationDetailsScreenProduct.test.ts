import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { HistoryProductDependencies } from '../../../capabilities/history/HistoryCacheHydration';
import type { HistoryEntry } from '../../../capabilities/history/types';
import { createLocalization } from '../../../locale/localization';
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
    expect(failureText?.props.accessibilityLiveRegion).toBe('polite');
    expect(failureText?.props.children).toBe('Couldn’t open the explorer. Try again.');
  });
});
