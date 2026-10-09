import { continueRequestToSendIfCurrent, createRequestRouteFocusLifetime } from '../requestContinueRouting';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Request Continue to Send async navigation', () => {
  it('navigates once when the attempt, current account and focused route remain valid', async () => {
    const navigate = jest.fn();
    const checkEligibility = jest.fn(async () => true);

    await continueRequestToSendIfCurrent({
      isCurrentAttempt: () => true,
      isCurrentRoute: () => true,
      checkEligibility,
      navigate,
    });

    expect(checkEligibility).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('ignores a Continue attempt invalidated by unmount or Back before eligibility resolves', async () => {
    const eligibility = deferred<boolean>();
    let attemptCurrent = true;
    let routeFocused = true;
    const navigate = jest.fn();

    const pending = continueRequestToSendIfCurrent({
      isCurrentAttempt: () => attemptCurrent,
      isCurrentRoute: () => routeFocused,
      checkEligibility: () => eligibility.promise,
      navigate,
    });
    // RequestFlowScreen cleanup invalidates the attempt; a Back gesture also blurs the route.
    attemptCurrent = false;
    routeFocused = false;
    eligibility.resolve(true);
    await pending;

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not navigate after the active account changes during eligibility lookup', async () => {
    const eligibility = deferred<boolean>();
    let currentAccountId = 'source-a';
    const navigate = jest.fn();

    const pending = continueRequestToSendIfCurrent({
      isCurrentAttempt: () => true,
      isCurrentRoute: () => currentAccountId === 'source-a',
      checkEligibility: () => eligibility.promise,
      navigate,
    });
    currentAccountId = 'source-b';
    eligibility.resolve(true);
    await pending;

    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores a route that loses focus while the Request screen remains mounted', async () => {
    const eligibility = deferred<boolean>();
    let focused = true;
    const navigate = jest.fn();

    const pending = continueRequestToSendIfCurrent({
      isCurrentAttempt: () => true,
      isCurrentRoute: () => focused,
      checkEligibility: () => eligibility.promise,
      navigate,
    });
    focused = false;
    eligibility.resolve(true);
    await pending;

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not start eligibility checks for an already-cancelled attempt', async () => {
    const checkEligibility = jest.fn(async () => true);
    const navigate = jest.fn();

    await continueRequestToSendIfCurrent({
      isCurrentAttempt: () => false,
      isCurrentRoute: () => true,
      checkEligibility,
      navigate,
    });

    expect(checkEligibility).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('fails closed for an ineligible current request without navigating', async () => {
    const navigate = jest.fn();

    await expect(
      continueRequestToSendIfCurrent({
        isCurrentAttempt: () => true,
        isCurrentRoute: () => true,
        checkEligibility: async () => false,
        navigate,
      }),
    ).rejects.toThrow('request-send-ineligible');

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Request route focus lifetime', () => {
  it('cancels the old Continue when the route blurs and refocuses while eligibility is pending', async () => {
    const eligibility = deferred<boolean>();
    const lifetime = createRequestRouteFocusLifetime();
    const navigate = jest.fn();
    lifetime.focus();

    const pending = continueRequestToSendIfCurrent({
      isCurrentAttempt: () => true,
      isCurrentRoute: lifetime.capture(),
      checkEligibility: () => eligibility.promise,
      navigate,
    });

    lifetime.blur();
    lifetime.focus();
    eligibility.resolve(true);
    await pending;

    expect(navigate).not.toHaveBeenCalled();
    expect(lifetime.capture()()).toBe(true);
  });

  it('invalidates attempts immediately upon losing Request focus', async () => {
    const lifetime = createRequestRouteFocusLifetime();
    lifetime.focus();
    const staleFocus = lifetime.capture();
    lifetime.blur();

    expect(staleFocus()).toBe(false);
    const eligibility = jest.fn(async () => true);
    const navigate = jest.fn();
    await continueRequestToSendIfCurrent({
      isCurrentAttempt: () => true,
      isCurrentRoute: staleFocus,
      checkEligibility: eligibility,
      navigate,
    });
    expect(eligibility).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('allows an explicit new Continue attempt after focus is regained', async () => {
    const lifetime = createRequestRouteFocusLifetime();
    lifetime.focus();
    const previous = lifetime.capture();
    lifetime.blur();
    lifetime.focus();
    const fresh = lifetime.capture();
    const navigate = jest.fn();

    expect(previous()).toBe(false);
    await continueRequestToSendIfCurrent({
      isCurrentAttempt: () => true,
      isCurrentRoute: fresh,
      checkEligibility: async () => true,
      navigate,
    });
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
