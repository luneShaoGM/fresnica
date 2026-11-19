import React from 'react';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { RequestPhotoQrPick } from '../../../capabilities/request/RequestIngressPort';
import type { RequestProductDependencies } from '../requestProductFlow';
import { RequestFlowScreen } from '../RequestFlowScreen';
import { RequestFormScreen } from '../RequestFormScreen';
import { RequestIngressScreen } from '../RequestIngressScreen';
import { createLedgerReadRuntime } from '../../../app/readModels/LedgerReadRuntime';
import { createRequestScanLifetime } from '../../../app/navigation/requestScanLifetime';
import { createRequestRouteFocusLifetime } from '../../../app/navigation/requestContinueRouting';

// Keep hook values across explicit renders without adding a component renderer dependency.
const mockHooks = {
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as { deps?: readonly unknown[]; cleanup?: () => void }[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
};

function mockDependenciesChanged(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
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
  useCallback: (callback: unknown) => callback,
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

  it('keeps photo selection disabled until a stale pick settles after the active account changes', async () => {
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
    expect(scan().photoBusy).toBe(true);
    expect(scan().result).toBeUndefined();
    (scan().onPickPhoto as unknown as () => Promise<void>)();
    scan().onRetry();
    expect(pickPaymentQrFromPhotos).toHaveBeenCalledTimes(1);
    expect(checkCameraPermission).toHaveBeenCalledTimes(1);

    resolvePhoto({ status: 'found', value: 'web+stellar:pay?destination=GDESTINATION&amount=1' });
    await picking;
    expect(scan().result).toBeUndefined();
    expect(scan().photoBusy).toBe(false);
    await scan().onRetry();
    expect(checkCameraPermission).toHaveBeenCalledTimes(2);
  });

  it('keeps photo selection disabled when the scan page reopens before the native read settles', async () => {
    let resolvePhoto!: (picked: RequestPhotoQrPick) => void;
    const pendingPhoto = new Promise<RequestPhotoQrPick>(resolve => {
      resolvePhoto = resolve;
    });
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
        checkCameraPermission: jest.fn().mockResolvedValue('blocked'),
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
    await (form.props as React.ComponentProps<typeof RequestFormScreen>).onScanRequest();
    const picking = (scan().onPickPhoto as unknown as () => Promise<void>)();
    expect(scan().photoBusy).toBe(true);

    scan().onClose();
    expect(render().type).toBe(RequestFormScreen);
    await (render().props as React.ComponentProps<typeof RequestFormScreen>).onScanRequest();
    expect(scan().photoBusy).toBe(true);
    expect(scan().platformError).toBeUndefined();
    (scan().onPickPhoto as unknown as () => Promise<void>)();
    expect(pickPaymentQrFromPhotos).toHaveBeenCalledTimes(1);

    resolvePhoto({ status: 'found', value: 'web+stellar:pay?destination=GDESTINATION&amount=1' });
    await picking;
    expect(scan().result).toBeUndefined();
    expect(scan().platformError).toBeUndefined();
    expect(scan().photoBusy).toBe(false);
  });
});

describe('Actions-origin general QR scan', () => {
  beforeEach(() => {
    mockHooks.states = [];
    mockHooks.refs = [];
    mockHooks.stateIndex = 0;
    mockHooks.refIndex = 0;
    mockHooks.effectIndex = 0;
    mockHooks.effects = [];
  });

  function setup(activeAccountId = account.id) {
    const checkCameraPermission = jest.fn().mockResolvedValue('granted');
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
        requestCameraPermission: jest.fn().mockResolvedValue('granted'),
        openCameraSettings: jest.fn().mockResolvedValue(undefined),
        pickPaymentQrFromPhotos: jest.fn().mockResolvedValue({ status: 'cancelled' }),
      },
    };
    const onScannedWebsite = jest.fn();
    const onDone = jest.fn();
    const runtime = createLedgerReadRuntime();
    const focus = createRequestRouteFocusLifetime();
    focus.focus();
    let background!: () => void;
    const lifetime = createRequestScanLifetime(runtime, retire => {
      background = retire;
      return () => undefined;
    });
    let props: React.ComponentProps<typeof RequestFlowScreen> = {
      account,
      activeAccountId,
      initialScan: true,
      captureScanSession: source => lifetime.capture(source, focus.capture()),
      onScannedWebsite: (url, isCurrent) =>
        lifetime.deliverWhenForeground(isCurrent, () => onScannedWebsite(url, isCurrent)),
      dependencies,
      ScannerView: () => null,
      onDone,
      onContinueSend: jest.fn().mockResolvedValue(undefined),
    };
    const render = () => {
      mockHooks.stateIndex = 0;
      mockHooks.refIndex = 0;
      mockHooks.effectIndex = 0;
      return RequestFlowScreen(props);
    };
    const scan = () => {
      props = { ...props, foreground: runtime.getSnapshot().foreground };
      render();
      return render().props as React.ComponentProps<typeof RequestIngressScreen>;
    };
    return {
      scan,
      render,
      onScannedWebsite,
      onDone,
      checkCameraPermission,
      dependencies,
      runtime,
      focus,
      background: () => {
        runtime.update({ foreground: false, connectivity: 'unknown' });
        background();
      },
    };
  }

  it('starts camera once, routes safe HTTPS through confirmation and closes on cancel', async () => {
    const { scan, render, onScannedWebsite, onDone, checkCameraPermission } = setup();
    render();
    await Promise.resolve();
    await Promise.resolve();
    expect(scan().scannerActive).toBe(true);
    expect(checkCameraPermission).toHaveBeenCalledTimes(1);
    const oldCameraCode = scan().onCode;
    oldCameraCode('https://wallet.example.org/path');
    oldCameraCode('https://other.example.org');
    expect(onScannedWebsite).toHaveBeenCalledTimes(1);
    expect(onScannedWebsite).toHaveBeenCalledWith('https://wallet.example.org/path', expect.any(Function));
    scan().onClose();
    oldCameraCode('https://late.example.org');
    expect(onScannedWebsite).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    render();
    expect(checkCameraPermission).toHaveBeenCalledTimes(1);
  });

  it('does not grant a website route to unsafe URLs', async () => {
    const { scan, render, onScannedWebsite } = setup();
    render();
    await Promise.resolve();
    await Promise.resolve();
    scan().onCode('http://wallet.example.org');
    expect(onScannedWebsite).not.toHaveBeenCalled();
    expect(scan().result?.result.status).toBe('rejected');
  });

  it('rejects credential-bearing/private HTTPS QR content and supports a photo HTTPS result', async () => {
    const { scan, render, onScannedWebsite, dependencies } = setup();
    render();
    await Promise.resolve();
    await Promise.resolve();
    scan().onCode('https://user:password@wallet.example.org/private');
    expect(onScannedWebsite).not.toHaveBeenCalled();
    expect(scan().result?.result.status).toBe('rejected');
    await scan().onRetry();
    scan().onCode('https://127.0.0.1/');
    expect(onScannedWebsite).not.toHaveBeenCalled();
    await scan().onRetry();
    (dependencies.ingress.pickPaymentQrFromPhotos as jest.Mock).mockResolvedValueOnce({
      status: 'found',
      value: 'https://photo.example.org/app',
    });
    await scan().onPickPhoto();
    expect(onScannedWebsite).toHaveBeenCalledTimes(1);
    expect(onScannedWebsite).toHaveBeenCalledWith('https://photo.example.org/app', expect.any(Function));
  });

  it.each(['camera', 'photo'] as const)('blocks sensitive HTTPS from %s before website handoff', async source => {
    const { scan, render, onScannedWebsite, dependencies } = setup();
    render();
    await Promise.resolve();
    await Promise.resolve();
    const secret = `S${'A'.repeat(55)}`;
    for (const url of [
      `https://wallet.example.org/${secret}`,
      `https://wallet.example.org/?key=${secret}`,
      `https://wallet.example.org/?key=%53${secret.slice(1)}`,
    ]) {
      if (source === 'camera') scan().onCode(url);
      else {
        (dependencies.ingress.pickPaymentQrFromPhotos as jest.Mock).mockResolvedValueOnce({
          status: 'found',
          value: url,
        });
        await scan().onPickPhoto();
      }
      expect(onScannedWebsite).not.toHaveBeenCalled();
      expect(scan().result?.result).toMatchObject({ status: 'rejected', reason: 'sensitive-input' });
      expect(JSON.stringify(scan().result)).not.toContain(secret);
      await scan().onRetry();
    }
    scan().onCode('https://wallet.example.org/safe');
    expect(onScannedWebsite).toHaveBeenCalledTimes(1);
  });

  it('rejects camera callbacks in background and after foreground return until explicit retry', async () => {
    const f = setup();
    f.render();
    await Promise.resolve();
    await Promise.resolve();
    const oldCode = f.scan().onCode;
    f.background();
    oldCode('https://wallet.example.org/background');
    f.runtime.update({ foreground: true, connectivity: 'unknown' });
    oldCode('https://wallet.example.org/late');
    expect(f.onScannedWebsite).not.toHaveBeenCalled();
    expect(f.scan().platformError).toBe('camera');
    expect(f.scan().scannerActive).toBe(false);
    await f.scan().onRetry();
    f.scan().onCode('https://wallet.example.org/retry');
    expect(f.onScannedWebsite).toHaveBeenCalledTimes(1);
  });

  it('rejects old camera and photo callbacks after route blur and refocus', async () => {
    const f = setup();
    f.render();
    await Promise.resolve();
    await Promise.resolve();
    let resolvePhoto!: (pick: RequestPhotoQrPick) => void;
    (f.dependencies.ingress.pickPaymentQrFromPhotos as jest.Mock).mockReturnValueOnce(
      new Promise<RequestPhotoQrPick>(resolve => {
        resolvePhoto = resolve;
      }),
    );
    const oldCode = f.scan().onCode;
    const picking = f.scan().onPickPhoto();
    f.focus.blur();
    f.focus.focus();
    resolvePhoto({ status: 'found', value: 'https://photo.example.org/late' });
    await picking;
    oldCode('https://wallet.example.org/late');
    expect(f.onScannedWebsite).not.toHaveBeenCalled();
    expect(f.scan().result).toBeUndefined();
  });

  it.each([false, true])('stages a photo website until foreground and respects cancel=%s', async cancel => {
    const f = setup();
    f.render();
    await Promise.resolve();
    await Promise.resolve();
    let resolvePhoto!: (pick: RequestPhotoQrPick) => void;
    (f.dependencies.ingress.pickPaymentQrFromPhotos as jest.Mock).mockReturnValueOnce(
      new Promise<RequestPhotoQrPick>(resolve => {
        resolvePhoto = resolve;
      }),
    );
    const picking = f.scan().onPickPhoto();
    f.background();
    resolvePhoto({ status: 'found', value: 'https://photo.example.org/app' });
    await picking;
    expect(f.onScannedWebsite).not.toHaveBeenCalled();
    if (cancel) f.scan().onClose();
    f.runtime.update({ foreground: true, connectivity: 'unknown' });
    expect(f.onScannedWebsite).toHaveBeenCalledTimes(cancel ? 0 : 1);
  });

  it('reuses payment parsing and refuses dApp handoff after the account changes', async () => {
    const first = setup('another-account');
    first.render();
    await Promise.resolve();
    first.scan().onCode('https://wallet.example.org');
    expect(first.onScannedWebsite).not.toHaveBeenCalled();
    expect(first.scan().result).toBeUndefined();
  });
});
