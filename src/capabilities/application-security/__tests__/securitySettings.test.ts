import { createSecuritySettings, DEFAULT_SECURITY_PREFERENCES, validateSecurityPreferences } from '../securitySettings';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
function fixture(protectedWallet = true) {
  const repository = new InMemoryAccountSignerRepository();
  if (protectedWallet)
    repository.createSigner({
      id: 's',
      kind: 'protected-software',
      publicKey: 'fixture',
      envelopeJson: 'fixture-envelope',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  const verify = jest.fn(async () => true),
    save = jest.fn(),
    apply = jest.fn(async () => {});
  let foreground = true,
    developer = false;
  const settings = createSecuritySettings({
    repository,
    sdk: { verifyProtectedSignerPassphrase: verify } as unknown as FresnicaSdkPort,
    store: { load: () => undefined, save },
    assertOpen: () => {},
    getAccess: () => ({ foreground, locked: false }),
    developerMode: () => developer,
    applyScreenProtection: apply,
  });
  return {
    settings,
    verify,
    save,
    apply,
    background: () => {
      foreground = false;
    },
    developer: () => {
      developer = true;
    },
  };
}
it('verifies a fresh passphrase on every protected change and never publishes a failed save', async () => {
  const f = fixture();
  f.verify.mockResolvedValueOnce(false);
  await expect(f.settings.update({ biometricUnlock: false }, 'wrong', new AbortController().signal)).rejects.toThrow();
  expect(f.save).not.toHaveBeenCalled();
  expect(f.settings.getSnapshot()).toBe(DEFAULT_SECURITY_PREFERENCES);
  await f.settings.update({ biometricUnlock: false }, 'fresh', new AbortController().signal);
  expect(f.settings.getSnapshot().biometricUnlock).toBe(false);
  expect(f.verify).toHaveBeenCalledTimes(2);
  f.save.mockImplementationOnce(() => {
    throw new Error('persistence');
  });
  await expect(f.settings.update({ backgroundTimeoutMs: 0 }, 'fresh', new AbortController().signal)).rejects.toThrow();
  expect(f.settings.getSnapshot().backgroundTimeoutMs).toBe(30000);
  expect(f.apply).toHaveBeenLastCalledWith(true);
});
it.each(['background', 'abort', 'close'] as const)('rejects a late verified change after %s', async why => {
  const f = fixture();
  let finish!: (v: boolean) => void;
  f.verify.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const owner = new AbortController();
  const result = f.settings.update({ backgroundTimeoutMs: 300000 }, 'fresh', owner.signal);
  if (why === 'background') f.background();
  if (why === 'abort') owner.abort();
  if (why === 'close') f.settings.close();
  finish(true);
  await expect(result).rejects.toThrow();
  expect(f.save).not.toHaveBeenCalled();
});
it('requires Developer Mode and native success before allowing screenshots; watch-only invents no passphrase', async () => {
  const f = fixture(false);
  await expect(
    f.settings.update({ screenCaptureProtection: false }, '', new AbortController().signal),
  ).rejects.toThrow();
  f.developer();
  f.apply.mockRejectedValueOnce(new Error('native-unavailable'));
  await expect(
    f.settings.update({ screenCaptureProtection: false }, '', new AbortController().signal),
  ).rejects.toThrow();
  expect(f.save).not.toHaveBeenCalled();
  await f.settings.update({ screenCaptureProtection: false }, '', new AbortController().signal);
  expect(f.settings.getSnapshot().screenCaptureProtection).toBe(false);
  expect(f.verify).not.toHaveBeenCalled();
});
it('accepts only bounded lock durations and safe shape', () => {
  for (const value of [-1, 1, 30001, '30000', Infinity])
    expect(() =>
      validateSecurityPreferences({ ...DEFAULT_SECURITY_PREFERENCES, backgroundTimeoutMs: value }),
    ).toThrow();
});
it('defaults corrupt persisted settings and preserves valid settings across controller recreation', async () => {
  const repository = new InMemoryAccountSignerRepository();
  let record: unknown = { biometricUnlock: true, backgroundTimeoutMs: -1, screenCaptureProtection: false };
  const dependencies = {
    repository,
    sdk: {} as FresnicaSdkPort,
    store: {
      load: () => record,
      save: (next: unknown) => {
        record = next;
      },
    },
    assertOpen: () => {},
    getAccess: () => ({ foreground: true, locked: false }),
    developerMode: () => true,
    applyScreenProtection: async () => {},
  };
  const first = createSecuritySettings(dependencies);
  expect(first.getSnapshot()).toBe(DEFAULT_SECURITY_PREFERENCES);
  await first.update({ backgroundTimeoutMs: 0, biometricUnlock: false }, '', new AbortController().signal);
  first.close();
  expect(createSecuritySettings(dependencies).getSnapshot()).toMatchObject({
    backgroundTimeoutMs: 0,
    biometricUnlock: false,
  });
});
