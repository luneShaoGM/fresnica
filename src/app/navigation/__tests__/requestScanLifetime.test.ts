import { createLedgerReadRuntime } from '../../readModels/LedgerReadRuntime';
import { createRequestRouteFocusLifetime } from '../requestContinueRouting';
import { createRequestScanLifetime } from '../requestScanLifetime';
import { captureSwapCurrentSession, type SwapCurrentSelection } from '../swapCurrentSession';

function setup() {
  const runtime = createLedgerReadRuntime();
  const focus = createRequestRouteFocusLifetime();
  focus.focus();
  const account = { id: 'a', address: 'GACCOUNT', networkId: 'testnet', identityKind: 'classic' as const };
  const network = { id: 'testnet', networkPassphrase: 'testnet-passphrase' };
  let selection: SwapCurrentSelection = {
    selectedAccountId: account.id,
    accounts: [{ ...account, hidden: false }],
    network,
    selectionRevision: 1,
  };
  let background!: () => void;
  const stopBackground = jest.fn();
  const lifetime = createRequestScanLifetime(runtime, retire => {
    background = retire;
    return stopBackground;
  });
  const capture = (source: 'camera' | 'photo') =>
    lifetime.capture(
      source,
      captureSwapCurrentSession({
        account,
        network,
        getCurrentSelection: () => selection,
        isCurrentFocusEpoch: focus.capture(),
      }),
    );
  const foreground = (value: boolean) => runtime.update({ foreground: value, connectivity: 'unknown' });
  return {
    runtime,
    lifetime,
    focus,
    capture,
    foreground,
    background: () => {
      foreground(false);
      background();
    },
    stopBackground,
    change: (next: Partial<SwapCurrentSelection>) => {
      selection = { ...selection, ...next };
    },
  };
}

describe('Request website scan lifetime', () => {
  it('retires camera frames in background and does not revive them on foreground return', () => {
    const f = setup();
    const current = f.capture('camera');
    const navigate = jest.fn();
    expect(current()).toBe(true);
    f.background();
    f.lifetime.deliverWhenForeground(current, navigate);
    expect(current()).toBe(false);
    f.foreground(true);
    f.lifetime.deliverWhenForeground(current, navigate);
    expect(navigate).not.toHaveBeenCalled();
    expect(f.capture('camera')()).toBe(true);
    f.lifetime.close();
  });

  it('blocks inactive camera callbacks while retaining the system permission dialog return', () => {
    const f = setup();
    const current = f.capture('camera');
    f.foreground(false);
    expect(current()).toBe(false);
    f.foreground(true);
    expect(current()).toBe(true);
    f.lifetime.close();
  });

  it.each(['camera', 'photo'] as const)('rejects %s results across blur/refocus', source => {
    const f = setup();
    const current = f.capture(source);
    f.focus.blur();
    f.focus.focus();
    const navigate = jest.fn();
    f.lifetime.deliverWhenForeground(current, navigate);
    expect(navigate).not.toHaveBeenCalled();
    f.lifetime.close();
  });

  it.each(['camera', 'photo'] as const)('rejects %s results after account/network ABA changes', source => {
    const f = setup();
    const current = f.capture(source);
    f.change({ selectedAccountId: 'b', selectionRevision: 2 });
    f.change({ selectedAccountId: 'a', selectionRevision: 3 });
    expect(current()).toBe(false);
    const next = f.capture(source);
    f.change({ network: { id: 'testnet', networkPassphrase: 'changed' } });
    expect(next()).toBe(false);
    f.lifetime.close();
  });

  it('waits for foreground before a valid system photo result navigates, then delivers once', () => {
    const f = setup();
    const current = f.capture('photo');
    const navigate = jest.fn();
    f.background();
    f.lifetime.deliverWhenForeground(current, navigate);
    expect(navigate).not.toHaveBeenCalled();
    f.foreground(true);
    f.runtime.update({ foreground: true, connectivity: 'online' });
    expect(navigate).toHaveBeenCalledTimes(1);
    f.lifetime.close();
  });

  it.each(['cancel', 'blur', 'account', 'close'] as const)('discards queued photo navigation on %s', reason => {
    const f = setup();
    const current = f.capture('photo');
    let attemptCurrent = true;
    const navigate = jest.fn();
    f.background();
    f.lifetime.deliverWhenForeground(() => attemptCurrent && current(), navigate);
    if (reason === 'cancel') attemptCurrent = false;
    if (reason === 'blur') {
      f.focus.blur();
      f.focus.focus();
    }
    if (reason === 'account') f.change({ selectionRevision: 2 });
    if (reason === 'close') f.lifetime.close();
    f.foreground(true);
    expect(navigate).not.toHaveBeenCalled();
    f.lifetime.close();
    expect(f.stopBackground).toHaveBeenCalled();
  });

  it('cannot start a photo session while backgrounded', () => {
    const f = setup();
    f.background();
    const current = f.capture('photo');
    f.foreground(true);
    expect(current()).toBe(false);
    f.lifetime.close();
  });
});
