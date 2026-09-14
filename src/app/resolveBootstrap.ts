import type { OnboardingProvisioningDependencies } from '@features/onboarding/runOnboardingProvisioning';
import { resolveOnboardingBootstrap, type OnboardingBootstrapState } from '@features/onboarding/onboardingBootstrap';

import type { AccountSelectionPreferenceStore } from './accountSelectionPreferences';

export type BootstrapSelectionDependencies = Readonly<{
  onboarding: OnboardingProvisioningDependencies;
  accountSelectionPreferences: Pick<AccountSelectionPreferenceStore, 'clearDefaultAccountId'>;
  onPreferenceFailure?: (networkId: string, error: unknown) => void;
}>;

export function resolveAppBootstrap(dependencies: BootstrapSelectionDependencies): OnboardingBootstrapState {
  const bootstrap = resolveOnboardingBootstrap(dependencies.onboarding);
  if (bootstrap.kind !== 'onboarding') {
    return bootstrap;
  }

  const networkId = dependencies.onboarding.networkId;
  try {
    dependencies.accountSelectionPreferences.clearDefaultAccountId(networkId);
  } catch (error) {
    dependencies.onPreferenceFailure?.(networkId, error);
  }
  return bootstrap;
}
