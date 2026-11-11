import { createApplicationSession } from '../applicationSession';
import { InMemoryAccountSignerRepository } from '../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { FresnicaSdkPort } from '../../capabilities/ports/FresnicaSdkPort';

function fixture(protectedSigner = true) {
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
    { repository, sdk: { verifyProtectedSignerPassphrase: verify } as unknown as FresnicaSdkPort },
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
