import {
  INITIAL_ONBOARDING_STATE,
  completeOnboarding,
  markGeneratedMnemonicBackupRequired,
  selectOnboardingMethod,
} from '../onboardingState';

describe('onboarding state', () => {
  it('contains only product sequence state', () => {
    expect(INITIAL_ONBOARDING_STATE).toEqual({step: 'choose-method'});
    expect(selectOnboardingMethod('import-secret')).toEqual({
      method: 'import-secret',
      step: 'collect-credentials',
    });
    expect(markGeneratedMnemonicBackupRequired()).toEqual({
      method: 'generate-mnemonic',
      step: 'backup-generated-mnemonic',
    });
    expect(completeOnboarding('watch-only')).toEqual({
      method: 'watch-only',
      step: 'complete',
    });
  });

  it('does not define secret, mnemonic, or passphrase fields', () => {
    const serialized = JSON.stringify({
      initial: INITIAL_ONBOARDING_STATE,
      selected: selectOnboardingMethod('generate-mnemonic'),
      backup: markGeneratedMnemonicBackupRequired(),
      complete: completeOnboarding('generate-mnemonic'),
    });

    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('mnemonic');
    expect(serialized).not.toContain('passphrase');
  });
});
