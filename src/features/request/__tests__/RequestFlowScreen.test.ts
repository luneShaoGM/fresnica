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
  stateIndex: 0,
  refIndex: 0,
};

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
  useEffect: () => undefined,
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
});
