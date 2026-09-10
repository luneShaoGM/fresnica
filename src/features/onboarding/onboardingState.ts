export type OnboardingMethod =
  | 'generate-mnemonic'
  | 'import-mnemonic'
  | 'import-secret'
  | 'watch-only';

export type OnboardingStep =
  | 'choose-method'
  | 'collect-credentials'
  | 'backup-generated-mnemonic'
  | 'complete';

export type OnboardingState = Readonly<{
  step: OnboardingStep;
  method?: OnboardingMethod;
}>;

export const INITIAL_ONBOARDING_STATE: OnboardingState = Object.freeze({
  step: 'choose-method',
});

export function selectOnboardingMethod(
  method: OnboardingMethod,
): OnboardingState {
  return Object.freeze({
    method,
    step: 'collect-credentials',
  });
}

export function markGeneratedMnemonicBackupRequired(): OnboardingState {
  return Object.freeze({
    method: 'generate-mnemonic',
    step: 'backup-generated-mnemonic',
  });
}

export function completeOnboarding(method: OnboardingMethod): OnboardingState {
  return Object.freeze({
    method,
    step: 'complete',
  });
}
