type RequestContinueRouting = Readonly<{
  isCurrentAttempt: () => boolean;
  isCurrentRoute: () => boolean;
  checkEligibility: () => Promise<boolean>;
  navigate: () => void;
}>;

// Awaiting live Payment eligibility must never authorize navigation for a stale route or account.
export async function continueRequestToSendIfCurrent({
  isCurrentAttempt,
  isCurrentRoute,
  checkEligibility,
  navigate,
}: RequestContinueRouting): Promise<void> {
  if (!isCurrentAttempt() || !isCurrentRoute()) return;

  const eligible = await checkEligibility();

  if (!isCurrentAttempt() || !isCurrentRoute()) return;
  if (!eligible) throw new Error('request-send-ineligible');

  navigate();
}

/**
 * Monotonic focus epoch. A previously focused Request route can become focused
 * again before a slow eligibility promise settles; its earlier attempt must not revive.
 */
export function createRequestRouteFocusLifetime() {
  let generation = 0;
  let focused = false;
  return {
    focus(): void {
      generation += 1;
      focused = true;
    },
    blur(): void {
      generation += 1;
      focused = false;
    },
    capture(): () => boolean {
      const captured = generation;
      return () => focused && generation === captured;
    },
  };
}
