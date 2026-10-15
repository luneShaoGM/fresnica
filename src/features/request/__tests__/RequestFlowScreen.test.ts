import React from 'react';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { RequestPhotoQrPick } from '../../../capabilities/request/RequestIngressPort';
import type { RequestProductDependencies } from '../requestProductFlow';
import { RequestFlowScreen } from '../RequestFlowScreen';
import { RequestFormScreen } from '../RequestFormScreen';
import { RequestIngressScreen } from '../RequestIngressScreen';

// Keep hook values across explicit renders without adding a component renderer dependency.
const mockHooks = {
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as { deps?: readonly unknown[]; cleanup?: () => void }[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
};

function mockDependenciesChanged(previous: readonly unknown[] | undefined, next: readonly unknown[] | undefined): boolean {
  if (previous === undefined || next === undefined || previous.length !== next.length) return true;
  return previous.some((value, index) => !Object.is(value, next[index]));
}

function mockApplyStateUpdate(next: unknown, previous: unknown): unknown {
  return typeof next === 'function' ? (next as (value: unknown) => unknown)(previous) : next;
}

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const index = mockHooks.stateIndex++;
    if (!(index in mockHooks.states)) mockHooks.states[index] = initial;
    return [
      mockHooks.states[index],
      (next: unknown) => {
        const previous = mockHooks.states[index];
        mockHooks.states[index] = mockApplyStateUpdate(next, previous);
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = mockHooks.refIndex++;
    if (!(index in mockHooks.refs)) mockHooks.refs[index] = { current: initial };
    return mockHooks.refs[index];
  },
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = mockHooks.effectIndex++;
    const previous = mockHooks.effects[index];
    if (previous !== undefined && !mockDependenciesChanged(previous.deps, deps)) return;
    previous?.cleanup?.();
    const cleanup = effect();
    mockHooks.effects[index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
  },
  useMemo: (compute: () => unknown) => compute(),
}));

jest.mock('../RequestFormScreen', () => ({ RequestFormScreen: () => null }));
jest.mock('../RequestIngressScreen', () => ({ RequestIngressScreen: () => null }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));

const account: AccountRecord = {
  id: 'account-request',
  address: 'GDESTINATION',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  label: 'Primary',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date('2026-10-15T00:00:00.000Z'),
  updatedAt: new Date('2026-10-15T00:00:00.000Z'),
};

describe('RequestFlowScreen photo retry', () => {
  beforeEach(() => {
    mockHooks.states = [];
    mockHooks.refs = [];
    mockHooks.stateIndex = 0;
    mockHooks.refIndex = 0;
    mockHooks.effectIndex = 0;
    mockHooks.effects = [];
  });

  it('ignores retry until a delayed photo pick settles, then permits retry again', async () => {
    let resolvePhoto!: (picked: RequestPhotoQrPick) => void;
    const pendingPhoto = new Promise<RequestPhotoQrPick>(resolve => {
      resolvePhoto = resolve;
    });
    const checkCameraPermission = jest.fn().mockResolvedValue('blocked');
    const pickPaymentQrFromPhotos = jest.fn().mockReturnValue(pendingPhoto);
    const dependencies: RequestProductDependencies = {
      gateway: {
        isClassicAccountAddress: value => value.startsWith('G'),
        loadAccountState: jest.fn().mockResolvedValue({ status: 'inactive', address: account.address }),
      },
      network: { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' },
      output: {
        copyRequestUri: jest.fn().mockResolvedValue(undefined),
        shareRequestUri: jest.fn().mockResolvedValue('dismissed'),
      },
      ingress: {
        readClipboardText: jest.fn().mockResolvedValue(''),
        checkCameraPermission,
        requestCameraPermission: jest.fn().mockResolvedValue('blocked'),
        openCameraSettings: jest.fn().mockResolvedValue(undefined),
        pickPaymentQrFromPhotos,
      },
    };

    const props: React.ComponentProps<typeof RequestFlowScreen> = {
      account,
      activeAccountId: account.id,
      dependencies,
      ScannerView: () => null,
      onDone: jest.fn(),
      onContinueSend: jest.fn().mockResolvedValue(undefined),
    };
    const render = () => {
      mockHooks.stateIndex = 0;
      mockHooks.refIndex = 0;
      mockHooks.effectIndex = 0;
      return RequestFlowScreen(props);
    };
    const scan = () => render().props as React.ComponentProps<typeof RequestIngressScreen>;

    const form = render();
    expect(form.type).toBe(RequestFormScreen);
    await (form.props as React.ComponentProps<typeof RequestFormScreen>).onScanRequest();
    expect(scan().permissionState).toBe('blocked');
    expect(checkCameraPermission).toHaveBeenCalledTimes(1);

    const picking = (scan().onPickPhoto as unknown as () => Promise<void>)();
    expect(scan().photoBusy).toBe(true);
    scan().onRetry();
    expect(checkCameraPermission).toHaveBeenCalledTimes(1);
    expect(scan().photoBusy).toBe(true);
    expect(pickPaymentQrFromPhotos).toHaveBeenCalledTimes(1);

    resolvePhoto({ status: 'cancelled' });
    await picking;
    expect(scan().photoBusy).toBe(false);
    await scan().onRetry();
    expect(checkCameraPermission).toHaveBeenCalledTimes(2);
  });

  it('drops a photo result and releases the busy state when the active account changes', async () => {
    let resolvePhoto!: (picked: RequestPhotoQrPick) => void;
    const pendingPhoto = new Promise<RequestPhotoQrPick>(resolve => {
      resolvePhoto = resolve;
    });
    const checkCameraPermission = jest.fn().mockResolvedValue('blocked');
    const dependencies: RequestProductDependencies = {
      gateway: {
        isClassicAccountAddress: value => value.startsWith('G'),
        loadAccountState: jest.fn().mockResolvedValue({ status: 'inactive', address: account.address }),
      },
      network: { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' },
      output: {
        copyRequestUri: jest.fn().mockResolvedValue(undefined),
        shareRequestUri: jest.fn().mockResolvedValue('dismissed'),
      },
      ingress: {
        readClipboardText: jest.fn().mockResolvedValue(''),
        checkCameraPermission,
        requestCameraPermission: jest.fn().mockResolvedValue('blocked'),
        openCameraSettings: jest.fn().mockResolvedValue(undefined),
        pickPaymentQrFromPhotos: jest.fn().mockReturnValue(pendingPhoto),
      },
    };
    let props: React.ComponentProps<typeof RequestFlowScreen> = {
      account,
      activeAccountId: account.id,
      dependencies,
      ScannerView: () => null,
      onDone: jest.fn(),
      onContinueSend: jest.fn().mockResolvedValue(undefined),
    };
    const render = () => {
      mockHooks.stateIndex = 0;
      mockHooks.refIndex = 0;
      mockHooks.effectIndex = 0;
      return RequestFlowScreen(props);
    };
    const scan = () => render().props as React.ComponentProps<typeof RequestIngressScreen>;

    const form = render();
    await (form.props as React.ComponentProps<typeof RequestFormScreen>).onScanRequest();
    const picking = (scan().onPickPhoto as unknown as () => Promise<void>)();
    expect(scan().photoBusy).toBe(true);

    props = { ...props, activeAccountId: 'account-other' };
    render();
    expect(scan().photoBusy).toBe(false);
    expect(scan().result).toBeUndefined();

    resolvePhoto({ status: 'found', value: 'web+stellar:pay?destination=GDESTINATION&amount=1' });
    await picking;
    expect(scan().result).toBeUndefined();
    expect(scan().photoBusy).toBe(false);
    await scan().onRetry();
    expect(checkCameraPermission).toHaveBeenCalledTimes(2);
  });
});
