import type { SessionAuthenticationPort } from '../../capabilities/ports/SessionAuthenticationPort';
import { createApplicationSession } from '../applicationSession';
import { InMemoryAccountSignerRepository } from '../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { FresnicaSdkPort } from '../../capabilities/ports/FresnicaSdkPort';

function fixture(protectedSigner = true, sessionAuthentication?: SessionAuthenticationPort) {
  const repository = new InMemoryAccountSignerRepository();
  if (protectedSigner)
    repository.createSigner({
      id: 'signer',
      kind: 'protected-software',
      publicKey: 'GDUMMY',
      envelopeJson: 'dummy-envelope',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  let time = 0;
  const verify = jest.fn(async () => true);
  const session = createApplicationSession(
    {
      repository,
      sessionAuthentication,
      sdk: { verifyProtectedSignerPassphrase: verify } as unknown as FresnicaSdkPort,
    },
    () => time,
  );
  return {
    session,
    repository,
    verify,
    setTime: (value: number) => {
      time = value;
    },
  };
}

test('cold protected wallet locks, wrong passphrase stays locked, retry succeeds', async () => {
  const f = fixture();
  expect(f.session.getSnapshot().locked).toBe(true);
  f.session.setForeground(true);
  f.verify.mockResolvedValueOnce(false);
  await expect(f.session.unlock('wrong dummy phrase')).rejects.toThrow();
  expect(f.session.getSnapshot().locked).toBe(true);
  await f.session.unlock('correct dummy phrase');
  expect(f.session.getSnapshot().locked).toBe(false);
});
test('background has a 30 second timeout and manual lock is immediate', async () => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('dummy phrase');
  f.session.setForeground(false);
  f.setTime(29999);
  f.session.setForeground(true);
  expect(f.session.getSnapshot().locked).toBe(false);
  f.session.setForeground(false);
  f.setTime(59999);
  f.session.setForeground(true);
  expect(f.session.getSnapshot().locked).toBe(true);
  await f.session.unlock('dummy phrase');
  f.session.lock();
  expect(f.session.getSnapshot().locked).toBe(true);
});
test('cancelled/background/closed verification cannot unlock, including a late success', async () => {
  for (const interrupt of ['cancel', 'background', 'close'] as const) {
    const f = fixture();
    let finish!: (value: boolean) => void;
    f.verify.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    f.session.setForeground(true);
    const pending = f.session.unlock('dummy phrase');
    if (interrupt === 'cancel') f.session.cancelUnlock();
    if (interrupt === 'background') f.session.setForeground(false);
    if (interrupt === 'close') f.session.close();
    finish(true);
    await expect(pending).rejects.toThrow();
    expect(f.session.getSnapshot().locked).toBe(true);
  }
});
test('watch-only has no invented credential, and zero targets never unlock', async () => {
  const f = fixture(false);
  f.session.setForeground(true);
  f.session.lock();
  expect(f.session.getSnapshot()).toMatchObject({ locked: false, canLock: false });
  await expect(f.session.unlock('anything')).rejects.toThrow();
  expect(f.verify).not.toHaveBeenCalled();
});
test('inventory changes during authentication fail closed', async () => {
  const f = fixture();
  let finish!: (value: boolean) => void;
  f.verify.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  f.session.setForeground(true);
  const pending = f.session.unlock('dummy phrase');
  f.repository.createSigner({
    id: 'second',
    publicKey: 'GOTHER',
    kind: 'protected-software',
    envelopeJson: 'dummy',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  finish(true);
  await expect(pending).rejects.toThrow('authorization-context-changed');
});
test('old SDK output cannot escape across a background or lock transition', async () => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('dummy phrase');
  let finish!: (value: string) => void;
  const native = jest.fn(
    () =>
      new Promise<string>(resolve => {
        finish = resolve;
      }),
  );
  const sdk = f.session.bindSensitive({ sign: native });
  const pending = sdk.sign();
  f.session.setForeground(false);
  f.session.setForeground(true);
  finish('dummy-signed-bytes');
  await expect(pending).rejects.toThrow('session-retired');
  f.session.lock();
  expect(() => sdk.sign()).toThrow('application-session-locked');
  expect(native).toHaveBeenCalledTimes(1);
});

test('a retired review cannot begin signing after a later successful unlock', async () => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('fixture phrase');
  const native = jest.fn(async () => 'dummy-signed');
  const old = f.session.bindSensitive({ sign: native }, f.session.getSnapshot().revision);
  let finishRead!: () => void;
  const slowPreflight = new Promise<void>(resolve => {
    finishRead = resolve;
  });
  const oldSubmission = (async () => {
    await slowPreflight;
    return old.sign();
  })();
  f.session.lock();
  await f.session.unlock('fixture phrase');
  finishRead();
  await expect(oldSubmission).rejects.toThrow('session-retired');
  expect(native).not.toHaveBeenCalled();
  const fresh = f.session.bindSensitive({ sign: native }, f.session.getSnapshot().revision);
  await expect(fresh.sign()).resolves.toBe('dummy-signed');
});

test('missed native background retires old results and conservatively requires authentication', async () => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('fixture phrase');
  const revision = f.session.getSnapshot().revision;
  f.session.retireMissedBackground();
  expect(f.session.getSnapshot()).toMatchObject({ locked: true, backgroundRevision: 1, revision: revision + 1 });
});

function biometricFixture() {
  const auth = {
    canAuthenticate: jest.fn(async () => true),
    authenticate: jest.fn(async () => true),
    cancel: jest.fn(),
  };
  return { ...fixture(true, auth), auth };
}
test('biometric App unlock never verifies or retains a wallet passphrase; manual lock requires a new OS authentication', async () => {
  const f = biometricFixture();
  f.session.setForeground(true);
  await expect(f.session.canUseBiometrics()).resolves.toBe(true);
  await f.session.unlockWithBiometrics('Unlock', 'Use passphrase');
  expect(f.session.getSnapshot().locked).toBe(false);
  expect(f.verify).not.toHaveBeenCalled();
  f.session.lock();
  await f.session.unlockWithBiometrics('Unlock', 'Use passphrase');
  expect(f.auth.authenticate).toHaveBeenCalledTimes(2);
});
test('failed biometrics stay locked, permit retry or independently verified passphrase fallback', async () => {
  const f = biometricFixture();
  f.session.setForeground(true);
  f.auth.authenticate.mockResolvedValueOnce(false);
  await expect(f.session.unlockWithBiometrics('Unlock', 'Passphrase')).rejects.toThrow();
  expect(f.session.getSnapshot().locked).toBe(true);
  await f.session.unlock('fallback phrase');
  expect(f.verify).toHaveBeenCalledTimes(1);
});
test.each(['cancel', 'background', 'close', 'inventory'] as const)(
  'late biometric success after %s never unlocks',
  async action => {
    const f = biometricFixture();
    f.session.setForeground(true);
    let finish!: (value: boolean) => void;
    f.auth.authenticate.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const pending = f.session.unlockWithBiometrics('Unlock', 'Passphrase');
    if (action === 'cancel') f.session.cancelUnlock();
    if (action === 'background') {
      f.session.setForeground(false);
      f.session.setForeground(true);
    }
    if (action === 'close') f.session.close();
    if (action === 'inventory')
      f.repository.createSigner({
        id: 'other',
        kind: 'protected-software',
        publicKey: 'GOTHER',
        envelopeJson: 'other',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    finish(true);
    await expect(pending).rejects.toThrow();
    expect(f.session.getSnapshot().locked).toBe(true);
    expect(f.verify).not.toHaveBeenCalled();
    if (action !== 'inventory') expect(f.auth.cancel).toHaveBeenCalled();
  },
);
test('cancelled biometric completion cannot clear a newer in-flight authentication', async () => {
  const f = biometricFixture();
  f.session.setForeground(true);
  let old!: (value: boolean) => void;
  let next!: (value: boolean) => void;
  f.auth.authenticate
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          old = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          next = resolve;
        }),
    );
  const first = f.session.unlockWithBiometrics('Unlock', 'Passphrase');
  f.session.cancelUnlock();
  const second = f.session.unlockWithBiometrics('Unlock', 'Passphrase');
  old(true);
  await expect(first).rejects.toThrow();
  await expect(f.session.unlockWithBiometrics('Unlock', 'Passphrase')).rejects.toThrow('session-unlock-unavailable');
  next(true);
  await second;
  expect(f.session.getSnapshot().locked).toBe(false);
});

test('explicit network rebuild continues browsing once without another credential, old authority is retired', async () => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('fixture phrase');
  const oldSdk = f.session.bindSensitive({ sign: jest.fn() });
  const continuation = f.session.continueAcrossNetworkChange();
  f.session.close();
  const next = createApplicationSession(
    { repository: f.repository, sdk: {} as FresnicaSdkPort },
    () => 0,
    continuation,
  );
  next.setForeground(true);
  expect(next.getSnapshot().locked).toBe(false);
  expect(f.verify).toHaveBeenCalledTimes(1);
  expect(() => oldSdk.sign()).toThrow('application-session-locked');
  const replay = createApplicationSession(
    { repository: f.repository, sdk: {} as FresnicaSdkPort },
    () => 0,
    continuation,
  );
  expect(replay.getSnapshot().locked).toBe(true);
  next.lock();
  expect(next.getSnapshot().locked).toBe(true);
});
test.each(['locked', 'background', 'pending'] as const)(
  'network browsing continuation is unavailable while %s',
  async action => {
    const f = fixture();
    f.session.setForeground(true);
    if (action !== 'locked') await f.session.unlock('fixture phrase');
    if (action === 'background') f.session.setForeground(false);
    if (action === 'pending') {
      f.session.lock();
      let complete!: (verified: boolean) => void;
      f.verify.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            complete = resolve;
          }),
      );
      const pending = f.session.unlock('fixture phrase');
      expect(f.session.continueAcrossNetworkChange()).toBeUndefined();
      complete(true);
      await pending;
      return;
    }
    expect(f.session.continueAcrossNetworkChange()).toBeUndefined();
  },
);
test.each(['cancel', 'timeout', 'inventory'] as const)('network continuation fails closed after %s', async action => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('fixture phrase');
  const continuation = f.session.continueAcrossNetworkChange()!;
  f.session.close();
  if (action === 'cancel') continuation.cancel();
  if (action === 'timeout') f.setTime(30000);
  if (action === 'inventory')
    f.repository.createSigner({
      id: 'new',
      kind: 'protected-software',
      publicKey: 'GNEW',
      envelopeJson: 'dummy',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  const next = createApplicationSession(
    { repository: f.repository, sdk: {} as FresnicaSdkPort },
    () => 0,
    continuation,
  );
  expect(next.getSnapshot().locked).toBe(true);
});

test('network continuation keeps cumulative background acknowledgements without changing timeout behavior', async () => {
  const f = fixture();
  f.session.setForeground(true);
  await f.session.unlock('fixture phrase');
  f.session.setForeground(false);
  f.setTime(100);
  f.session.setForeground(true);
  const continuation = f.session.continueAcrossNetworkChange();
  f.session.close();
  const next = createApplicationSession(
    { repository: f.repository, sdk: {} as FresnicaSdkPort },
    () => 100,
    continuation,
  );
  next.setForeground(true);
  expect(next.getSnapshot()).toMatchObject({ locked: false, backgroundRevision: 1 });
  next.setForeground(false);
  expect(next.getSnapshot().backgroundRevision).toBe(2);
});

test('configured timeout and disabled biometric preference enforce access without weakening passphrase fallback', async () => {
  const repository = new InMemoryAccountSignerRepository();
  repository.createSigner({
    id: 'p',
    kind: 'protected-software',
    publicKey: 'fixture',
    envelopeJson: 'fixture',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  let time = 0;
  let biometricUnlock = true;
  const authenticate = jest.fn(async () => true);
  const session = createApplicationSession(
    {
      repository,
      sdk: { verifyProtectedSignerPassphrase: async () => true } as unknown as FresnicaSdkPort,
      sessionAuthentication: { canAuthenticate: async () => true, authenticate, cancel: jest.fn() },
      getSecurityPreferences: () => ({ biometricUnlock, backgroundTimeoutMs: 60000, screenCaptureProtection: true }),
    },
    () => time,
  );
  session.setForeground(true);
  await session.unlock('fresh');
  session.setForeground(false);
  time = 30000;
  session.setForeground(true);
  expect(session.getSnapshot().locked).toBe(false);
  session.setForeground(false);
  time = 90000;
  session.setForeground(true);
  expect(session.getSnapshot().locked).toBe(true);
  biometricUnlock = false;
  session.refreshSecurityPreferences();
  expect(await session.canUseBiometrics()).toBe(false);
  await expect(session.unlockWithBiometrics('unlock', 'cancel')).rejects.toThrow();
  expect(authenticate).not.toHaveBeenCalled();
  await session.unlock('fresh');
  expect(session.getSnapshot().locked).toBe(false);
});

test('disabling biometric preference cancels an in-flight OS prompt and drops late success', async () => {
  const f = fixture();
  let enabled = true;
  let finish!: (value: boolean) => void;
  const cancel = jest.fn();
  const session = createApplicationSession({
    repository: f.repository,
    sdk: { verifyProtectedSignerPassphrase: async () => true } as unknown as FresnicaSdkPort,
    getSecurityPreferences: () => ({
      biometricUnlock: enabled,
      backgroundTimeoutMs: 30000,
      screenCaptureProtection: true,
    }),
    sessionAuthentication: {
      canAuthenticate: async () => true,
      authenticate: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
      cancel,
    },
  });
  session.setForeground(true);
  const pending = session.unlockWithBiometrics('unlock', 'cancel');
  enabled = false;
  session.refreshSecurityPreferences();
  finish(true);
  await expect(pending).rejects.toThrow();
  expect(cancel).toHaveBeenCalled();
  expect(session.getSnapshot().locked).toBe(true);
});
