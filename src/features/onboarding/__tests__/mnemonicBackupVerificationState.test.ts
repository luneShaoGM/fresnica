import {
  beginMnemonicBackupVerification,
  evaluateMnemonicBackupVerification,
  MNEMONIC_BACKUP_PRESENTATION,
  returnToMnemonicBackupPresentation,
  updateMnemonicBackupAnswer,
} from '../mnemonicBackupVerificationState';

const mnemonic = 'alpha beta gamma delta epsilon zeta golf hotel india juliet kilo lima';

function deterministicRandom() {
  return jest.fn<number, []>().mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValueOnce(0.9);
}

describe('mnemonic backup verification state', () => {
  it('selects three distinct positions from the current in-memory phrase', () => {
    expect(beginMnemonicBackupVerification(mnemonic, deterministicRandom())).toEqual({
      kind: 'challenge',
      positions: [0, 6, 11],
      answers: ['', '', ''],
      mismatch: false,
    });
  });
  it('requests every position when the phrase has fewer than three words', () => {
    expect(beginMnemonicBackupVerification('alpha beta', () => 0)).toEqual({
      kind: 'challenge',
      positions: [0, 1],
      answers: ['', ''],
      mismatch: false,
    });
  });

  it('matches exact requested positions while normalizing case and surrounding whitespace', () => {
    let state = beginMnemonicBackupVerification(mnemonic, deterministicRandom());
    state = updateMnemonicBackupAnswer(state, 0, ' ALPHA ');
    state = updateMnemonicBackupAnswer(state, 1, 'Golf');
    state = updateMnemonicBackupAnswer(state, 2, ' lima ');

    expect(evaluateMnemonicBackupVerification(mnemonic, state)).toMatchObject({
      verified: true,
      state: { kind: 'challenge', mismatch: false },
    });
  });

  it('allows a wrong answer to be corrected and submitted successfully', () => {
    let state = beginMnemonicBackupVerification(mnemonic, deterministicRandom());
    state = updateMnemonicBackupAnswer(state, 0, 'alpha');
    state = updateMnemonicBackupAnswer(state, 1, 'wrong');
    state = updateMnemonicBackupAnswer(state, 2, 'lima');
    const failed = evaluateMnemonicBackupVerification(mnemonic, state);
    expect(failed.verified).toBe(false);
    expect(failed.state).toMatchObject({ kind: 'challenge', mismatch: true });

    state = updateMnemonicBackupAnswer(failed.state, 1, 'golf');
    expect(state).toMatchObject({ kind: 'challenge', mismatch: false });

    const corrected = evaluateMnemonicBackupVerification(mnemonic, state);
    expect(corrected.verified).toBe(true);
    expect(corrected.state).toMatchObject({ kind: 'challenge', mismatch: false });
  });

  it('returns to phrase presentation without retaining challenge answers or mismatch state', () => {
    let state = beginMnemonicBackupVerification(mnemonic, deterministicRandom());
    state = updateMnemonicBackupAnswer(state, 0, 'wrong');
    state = evaluateMnemonicBackupVerification(mnemonic, state).state;

    expect(state).toMatchObject({ kind: 'challenge', mismatch: true });
    expect(returnToMnemonicBackupPresentation()).toBe(MNEMONIC_BACKUP_PRESENTATION);
    expect(returnToMnemonicBackupPresentation()).toEqual({ kind: 'phrase' });
  });

  it('fails closed for an invalid random source', () => {
    expect(() => beginMnemonicBackupVerification(mnemonic, () => 1)).toThrow('mnemonic-backup-random-invalid');
  });
});
