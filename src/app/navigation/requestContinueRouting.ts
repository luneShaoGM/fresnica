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
