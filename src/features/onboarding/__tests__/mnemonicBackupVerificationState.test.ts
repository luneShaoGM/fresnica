import {
  beginMnemonicBackupVerification,
  evaluateMnemonicBackupVerification,
  MNEMONIC_BACKUP_PRESENTATION,
  returnToMnemonicBackupPresentation,
  updateMnemonicBackupAnswer,
} from '../mnemonicBackupVerificationState';

const mnemonic = 'alpha beta gamma delta epsilon zeta golf hotel india juliet kilo lima';
const random = () => jest.fn<number, []>().mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(0.9);

it('keeps only three distinct positions, presence and mismatch in public challenge state', () => {
  expect(beginMnemonicBackupVerification(12, random())).toEqual({
    kind: 'challenge', positions: [0, 6, 11], answersPresent: [false, false, false], mismatch: false,
  });
  expect(beginMnemonicBackupVerification(2, () => 0)).toEqual({
    kind: 'challenge', positions: [0, 1], answersPresent: [false, false], mismatch: false,
  });
});

it('matches exact positions with trim/case normalization without returning the transient answers', () => {
  let state = beginMnemonicBackupVerification(12, random());
  state = updateMnemonicBackupAnswer(state, 0, true);
  const result = evaluateMnemonicBackupVerification(mnemonic, state, [' ALPHA ', 'Golf', ' lima ']);
  expect(result.verified).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/alpha|golf|lima/i);
  expect(evaluateMnemonicBackupVerification(mnemonic, state, ['alpha', 'beta', 'gamma']).verified).toBe(false);
});

it('clears mismatch on correction, retains positions and succeeds after a wrong answer', () => {
  const state = beginMnemonicBackupVerification(12, random());
  const failed = evaluateMnemonicBackupVerification(mnemonic, state, ['alpha', 'wrong', 'lima']);
  expect(failed).toMatchObject({ verified: false, state: { mismatch: true } });
  const corrected = updateMnemonicBackupAnswer(failed.state, 1, true);
  expect(corrected).toMatchObject({ positions: [0, 6, 11], mismatch: false });
  expect(evaluateMnemonicBackupVerification(mnemonic, corrected, ['alpha', 'golf', 'lima']).verified).toBe(true);
  expect(returnToMnemonicBackupPresentation()).toBe(MNEMONIC_BACKUP_PRESENTATION);
});

it('fails closed without a phrase/challenge or with invalid randomness', () => {
  expect(() => beginMnemonicBackupVerification(0)).toThrow('mnemonic-backup-empty');
  expect(() => beginMnemonicBackupVerification(12, () => 1)).toThrow('mnemonic-backup-random-invalid');
  expect(evaluateMnemonicBackupVerification(mnemonic, MNEMONIC_BACKUP_PRESENTATION, []).verified).toBe(false);
});
