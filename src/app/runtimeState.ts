import type {OnboardingBootstrapState} from '@features/onboarding/onboardingBootstrap';

import type {AppServices} from './createAppServices';

export type AppRuntimeState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'error'; message?: string}>
  | Readonly<{
      kind: 'ready';
      services: AppServices;
      bootstrap: OnboardingBootstrapState;
    }>;
