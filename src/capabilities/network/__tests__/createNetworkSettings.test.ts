import { NodeReadError } from '../NodeReadError';
import { createNetworkSettings } from '../createNetworkSettings';
import { DEFAULT_NETWORK_PREFERENCES, NETWORKS, type NetworkPreferences } from '../networkPreferences';
const main = 'stellar-mainnet';
const testnet = 'stellar-testnet';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
function setup(developerMode = true, initial?: NetworkPreferences) {
  let saved = initial ?? { ...DEFAULT_NETWORK_PREFERENCES, developerMode };
  let foreground = true;
  const store = {
    load: () => saved,
    save: jest.fn((next: NetworkPreferences) => {
      saved = next;
    }),
  };
  const authorize = jest.fn(async (_passphrase: string, _signal: AbortSignal) => {});
  const probe = jest.fn(
    async (_endpoint: string, _signal: AbortSignal): Promise<string> => NETWORKS[main].networkPassphrase,
  );
  const assertCanSwitch = jest.fn((_id: string) => {});
  const restart = jest.fn();
  const settings = createNetworkSettings({
    store,
    authorize,
    probe,
    assertCanSwitch,
    restart,
    isForeground: () => foreground,
  });
  return {
    settings,
    store,
    authorize,
    probe,
    restart,
    assertCanSwitch,
    saved: () => saved,
    background: () => {
      foreground = false;
      settings.cancel();
    },
  };
}
describe('authenticated node and network settings', () => {
  it('requires authorization to enable and keeps old preferences on failure, then permits explicit retry', async () => {
    const s = setup(false);
    await expect(s.settings.addNode(main, 'https://a.test')).rejects.toThrow('developer-mode-required');
    s.authorize.mockRejectedValueOnce(new Error('wrong-credential'));
    await expect(s.settings.enableDeveloperMode('wrong')).rejects.toThrow('wrong-credential');
    expect(s.saved().developerMode).toBe(false);
    expect(s.store.save).not.toHaveBeenCalled();
    await s.settings.enableDeveloperMode('fresh secret');
    expect(s.authorize).toHaveBeenLastCalledWith('fresh secret', expect.any(AbortSignal));
    expect(s.saved().developerMode).toBe(true);
    expect(JSON.stringify(s.settings.getSnapshot())).not.toContain('fresh secret');
    expect(s.restart).not.toHaveBeenCalled();
  });
  it('cancels late authorization and rejects duplicate submissions and background completion', async () => {
    const s = setup(false);
    const auth = deferred<void>();
    s.authorize.mockReturnValueOnce(auth.promise);
    const work = s.settings.enableDeveloperMode('secret');
    await expect(s.settings.enableDeveloperMode('second')).rejects.toThrow('network-settings-busy');
    s.background();
    auth.resolve();
    await expect(work).rejects.toThrow('operation-cancelled');
    expect(s.store.save).not.toHaveBeenCalled();
    expect(s.settings.getSnapshot().busy).toBe(false);
  });
  it('keeps a retained partition restricted and verifies its node before selection', async () => {
    const s = setup(false, {
      ...DEFAULT_NETWORK_PREFERENCES,
      retainedTestnet: true,
      selectionConfirmed: false,
      customNodes: { ...DEFAULT_NETWORK_PREFERENCES.customNodes, 'stellar-testnet': ['https://saved-custom.test'] },
    });
    await expect(s.settings.selectNode(testnet, 'https://saved-custom.test')).rejects.toThrow(
      'developer-mode-required',
    );
    await expect(s.settings.selectNode(testnet, NETWORKS[testnet].horizonUrl)).rejects.toThrow('wrong-network');
    expect(s.store.save).not.toHaveBeenCalled();
    s.probe.mockResolvedValueOnce(NETWORKS[testnet].networkPassphrase);
    await s.settings.selectNode(testnet, NETWORKS[testnet].horizonUrl);
    expect(s.saved()).toMatchObject({
      developerMode: false,
      retainedTestnet: true,
      selectionConfirmed: true,
      networkId: testnet,
    });
    await expect(s.settings.addNode(testnet, 'https://new.test')).rejects.toThrow('developer-mode-required');
    await expect(s.settings.removeNode(testnet, 'https://saved-custom.test')).rejects.toThrow(
      'developer-mode-required',
    );
    await s.settings.selectNode(main, NETWORKS[main].horizonUrl);
    expect(s.saved().retainedTestnet).toBe(true);
    expect(s.authorize).not.toHaveBeenCalled();
  });
  it('adds only a verified unique node without silently selecting it', async () => {
    const s = setup();
    await s.settings.addNode(main, ' https://node.test/ ');
    expect(s.saved().customNodes[main]).toEqual(['https://node.test']);
    expect(s.saved().endpoints[main]).toBe(NETWORKS[main].horizonUrl);
    await expect(s.settings.addNode(main, 'https://node.test')).rejects.toThrow('duplicate-node');
    expect(s.probe).toHaveBeenCalledTimes(1);
    expect(s.restart).not.toHaveBeenCalled();
  });
  it('does not add or select a wrong-network endpoint and allows a new explicit retry', async () => {
    const s = setup();
    s.probe.mockResolvedValueOnce(NETWORKS[testnet].networkPassphrase);
    await expect(s.settings.addNode(main, 'https://wrong.test')).rejects.toThrow('wrong-network');
    expect(s.store.save).not.toHaveBeenCalled();
    await s.settings.addNode(main, 'https://right.test');
    const before = s.saved();
    s.probe.mockResolvedValueOnce(NETWORKS[testnet].networkPassphrase);
    await expect(s.settings.selectNode(main, 'https://right.test')).rejects.toThrow('wrong-network');
    expect(s.saved()).toBe(before);
    expect(s.restart).not.toHaveBeenCalled();
  });
  it('persists the verified identity before restart and keeps state atomic on storage failure', async () => {
    const s = setup();
    await s.settings.addNode(main, 'https://custom.test');
    const before = s.settings.getSnapshot().preferences;
    s.store.save.mockImplementationOnce(() => {
      throw new Error('disk-full');
    });
    await expect(s.settings.selectNode(main, 'https://custom.test')).rejects.toThrow('disk-full');
    expect(s.settings.getSnapshot().preferences).toBe(before);
    expect(s.restart).not.toHaveBeenCalled();
    s.probe.mockResolvedValueOnce(NETWORKS[testnet].networkPassphrase);
    s.restart.mockImplementationOnce(() => {
      expect(s.saved().networkId).toBe(testnet);
    });
    await s.settings.selectNode(testnet, NETWORKS[testnet].horizonUrl);
    expect(s.restart).toHaveBeenCalledTimes(1);
  });
  it('protects the built-in node and verifies fallback before atomically deleting the selected custom node', async () => {
    const s = setup();
    await s.settings.addNode(main, 'https://custom.test');
    await s.settings.selectNode(main, 'https://custom.test');
    await expect(s.settings.removeNode(main, NETWORKS[main].horizonUrl)).rejects.toThrow('built-in-node');
    const before = s.saved();
    s.probe.mockRejectedValueOnce(new Error('offline'));
    await expect(s.settings.removeNode(main, 'https://custom.test')).rejects.toThrow('node-unavailable');
    expect(s.saved()).toBe(before);
    await s.settings.removeNode(main, 'https://custom.test');
    expect(s.saved().endpoints[main]).toBe(NETWORKS[main].horizonUrl);
    expect(s.saved().customNodes[main]).toEqual([]);
  });
  it('requires verified Mainnet and an idle session before disabling, with no partial preference writes', async () => {
    const s = setup(true, { ...DEFAULT_NETWORK_PREFERENCES, developerMode: true, networkId: testnet });
    s.probe.mockRejectedValueOnce(new Error('offline'));
    await expect(s.settings.disableDeveloperMode()).rejects.toThrow('node-unavailable');
    expect(s.saved().developerMode).toBe(true);
    s.assertCanSwitch.mockImplementationOnce(() => {
      throw new Error('pending-submission');
    });
    await expect(s.settings.disableDeveloperMode()).rejects.toThrow('pending-submission');
    expect(s.store.save).not.toHaveBeenCalled();
    await s.settings.disableDeveloperMode();
    expect(s.saved()).toMatchObject({ developerMode: false, networkId: main });
    expect(s.saved().endpoints[main]).toBe(NETWORKS[main].horizonUrl);
    expect(s.restart).toHaveBeenCalledTimes(1);
  });
  it('rechecks session eligibility after probing to close an operation-start race', async () => {
    const s = setup();
    const probe = deferred<string>();
    s.probe.mockReturnValueOnce(probe.promise);
    const work = s.settings.selectNode(testnet, NETWORKS[testnet].horizonUrl);
    s.assertCanSwitch.mockImplementationOnce(() => {
      throw new Error('network-session-busy');
    });
    probe.resolve(NETWORKS[testnet].networkPassphrase);
    await expect(work).rejects.toThrow('network-session-busy');
    expect(s.store.save).not.toHaveBeenCalled();
  });
  it('cancels a non-cooperative probe, ignores its late response and permits an explicit retry', async () => {
    const s = setup();
    const probe = deferred<string>();
    s.probe.mockReturnValueOnce(probe.promise);
    const work = s.settings.addNode(main, 'https://late.test');
    s.settings.cancel();
    await expect(work).rejects.toThrow('operation-cancelled');
    probe.resolve(NETWORKS[main].networkPassphrase);
    await Promise.resolve();
    expect(s.store.save).not.toHaveBeenCalled();
    await s.settings.addNode(main, 'https://retry.test');
    expect(s.saved().customNodes[main]).toEqual(['https://retry.test']);
  });
  it('honors a node Retry-After across repeated manual tests', async () => {
    jest.useFakeTimers();
    try {
      const s = setup();
      s.probe.mockRejectedValueOnce(new NodeReadError('rate-limited', 60000));
      await s.settings.testNode(main, NETWORKS[main].horizonUrl);
      await s.settings.testNode(main, NETWORKS[main].horizonUrl);
      expect(s.probe).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(60000);
      await expect(s.settings.testNode(main, NETWORKS[main].horizonUrl)).resolves.toMatchObject({
        status: 'reachable',
      });
      expect(s.probe).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
  it('enforces the probe deadline and publishes safe test results without changing connectivity', async () => {
    jest.useFakeTimers();
    try {
      const s = setup();
      const probe = deferred<string>();
      s.probe.mockReturnValueOnce(probe.promise);
      const work = s.settings.testNode(main, NETWORKS[main].horizonUrl);
      jest.advanceTimersByTime(10000);
      await expect(work).resolves.toMatchObject({ status: 'unavailable' });
      expect(s.probe.mock.calls[0]?.[1].aborted).toBe(true);
      expect(s.store.save).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
