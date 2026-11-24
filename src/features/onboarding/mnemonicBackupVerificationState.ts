export const MNEMONIC_BACKUP_CHALLENGE_SIZE = 3;

export type MnemonicBackupVerificationState =
  | Readonly<{ kind: 'phrase' }>
  | Readonly<{
      kind: 'challenge';
      positions: readonly number[];
      answersPresent: readonly boolean[];
      mismatch: boolean;
    }>;

export const MNEMONIC_BACKUP_PRESENTATION: MnemonicBackupVerificationState = Object.freeze({
  kind: 'phrase',
});

export function beginMnemonicBackupVerification(
  wordCount: number,
  random: () => number = Math.random,
): MnemonicBackupVerificationState {
  if (!Number.isSafeInteger(wordCount) || wordCount < 1) throw new Error('mnemonic-backup-empty');
  const count = Math.min(MNEMONIC_BACKUP_CHALLENGE_SIZE, wordCount);
  const candidates = Array.from({ length: wordCount }, (_, index) => index);

  for (let cursor = 0; cursor < count; cursor += 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error('mnemonic-backup-random-invalid');
    }
    const target = cursor + Math.floor(value * (candidates.length - cursor));
    [candidates[cursor], candidates[target]] = [candidates[target], candidates[cursor]];
  }

  const positions = candidates.slice(0, count).sort((left, right) => left - right);
  return {
    kind: 'challenge',
    positions,
    answersPresent: positions.map(() => false),
    mismatch: false,
  };
}

export function updateMnemonicBackupAnswer(
  state: MnemonicBackupVerificationState,
  answerIndex: number,
  present: boolean,
): MnemonicBackupVerificationState {
  if (state.kind !== 'challenge' || answerIndex < 0 || answerIndex >= state.answersPresent.length) {
    return state;
  }

  const answersPresent = [...state.answersPresent];
  answersPresent[answerIndex] = present;
  return {
    ...state,
    answersPresent,
    mismatch: false,
  };
}
export function evaluateMnemonicBackupVerification(
  mnemonic: string,
  state: MnemonicBackupVerificationState,
  answers: readonly string[],
): Readonly<{ state: MnemonicBackupVerificationState; verified: boolean }> {
  if (state.kind !== 'challenge') {
    return { state, verified: false };
  }

  const words = mnemonicWords(mnemonic);
  const verified =
    state.positions.length > 0 &&
    new Set(state.positions).size === state.positions.length &&
    state.positions.every(
      (position, answerIndex) =>
        position >= 0 &&
        position < words.length &&
        normalizeMnemonicWord(answers[answerIndex] ?? '') === normalizeMnemonicWord(words[position]),
    );

  return {
    state: verified ? { ...state, mismatch: false } : { ...state, mismatch: true },
    verified,
  };
}

export function returnToMnemonicBackupPresentation(): MnemonicBackupVerificationState {
  return MNEMONIC_BACKUP_PRESENTATION;
}

function mnemonicWords(mnemonic: string): string[] {
  const normalized = mnemonic.trim();
  if (!normalized) {
    throw new Error('mnemonic-backup-empty');
  }
  return normalized.split(/\s+/u);
}

function normalizeMnemonicWord(value: string): string {
  return value.trim().toLowerCase();
}
