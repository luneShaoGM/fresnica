import type { FresnicaSdkPort } from '../capabilities/ports/FresnicaSdkPort';
import type { AppServices } from './createAppServices';

// Bind before product work begins, so delayed preflight cannot borrow a later unlock.
export function leaseSessionServices(services: AppServices, revision: number): AppServices {
  const session = services.applicationSession;
  if (!session) return services;
  const bind = <T extends { sdk: FresnicaSdkPort }>(dependencies: T): T => ({
    ...dependencies,
    sdk: session.bindSensitive(dependencies.sdk, revision),
  });
  return {
    ...services,
    onboarding: bind(services.onboarding),
    security: bind(services.security),
    recoveryManagement: services.recoveryManagement
      ? {
          ...bind(services.recoveryManagement),
          repository: session.bindSensitive(services.recoveryManagement.repository, revision),
        }
      : undefined,
    send: bind(services.send),
    trustline: bind(services.trustline),
    swapExecution: bind(services.swapExecution),
    claimableTransaction: bind(services.claimableTransaction),
  };
}
