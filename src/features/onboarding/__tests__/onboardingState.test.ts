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
    const states = [
      INITIAL_ONBOARDING_STATE,
      selectOnboardingMethod('generate-mnemonic'),
      markGeneratedMnemonicBackupRequired(),
      completeOnboarding('generate-mnemonic'),
    ];

    for (const state of states) {
      expect(Object.keys(state)).not.toContain('secret');
      expect(Object.keys(state)).not.toContain('mnemonic');
      expect(Object.keys(state)).not.toContain('passphrase');
      expect(Object.keys(state)).not.toContain('appPassphrase');
    }
  });
});
