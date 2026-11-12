package com.fresnica.wallet;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.BridgeReactContext;
import com.facebook.react.bridge.ReactApplicationContext;
import java.lang.reflect.Proxy;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicInteger;

/** Real AndroidX 1.1.0 + production module, with its client executor deliberately delayed.
 * No wallet, credentials, sensor enrollment or successful biometric is required.
 * Mechanism regression only; this is not native wallet product-flow acceptance.
 */
public final class SessionAuthenticationNativeTest extends Instrumentation {
  private SessionAuthenticationFixtureActivity activity;
  private SessionAuthenticationModule module;
  private ReactApplicationContext context;
  private final ConcurrentLinkedQueue<Runnable> callbacks = new ConcurrentLinkedQueue<>();
  private final Executor delayedExecutor = callbacks::add;

  private static final class Result {
    final AtomicInteger settlements = new AtomicInteger();
    volatile Object value;
    volatile String error;
    final Promise promise = (Promise) Proxy.newProxyInstance(Promise.class.getClassLoader(),
        new Class<?>[] { Promise.class }, (proxy, method, args) -> {
          if (method.getName().equals("resolve")) {
            value = args[0]; settlements.incrementAndGet();
          } else if (method.getName().equals("reject")) {
            error = String.valueOf(args[0]); settlements.incrementAndGet();
          }
          return null;
        });
  }

  @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }

  @Override public void onStart() {
    boolean success = false;
    String detail = "";
    try {
      Intent intent = new Intent(getTargetContext(), SessionAuthenticationFixtureActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity = (SessionAuthenticationFixtureActivity) startActivitySync(intent);
      onUi(() -> {
        context = new BridgeReactContext(getTargetContext());
        context.onHostResume(activity);
        module = new SessionAuthenticationModule(context, delayedExecutor);
      });
      Result first = new Result();
      onUi(() -> module.authenticate("first", "Unlock test fixture", "Cancel", first.promise));
      waitForIdleSync();
      onUi(() -> module.cancel("first"));
      check(Boolean.FALSE.equals(first.value) && first.settlements.get() == 1, "cancel-must-settle-js-once: value=" + first.value + " error=" + first.error + " count=" + first.settlements.get());

      // The old AndroidX cancellation/error has not reached its client callback.
      Result retry = new Result();
      onUi(() -> module.authenticate("too-soon", "Retry test fixture", "Cancel", retry.promise));
      check("session-auth-unavailable".equals(retry.error), "retry-admitted-before-old-native-terminal: error=" + retry.error + " value=" + retry.value + " count=" + retry.settlements.get() + " queued=" + callbacks.size());
      awaitCallback();
      drainCallbacks();
      check(first.settlements.get() == 1, "old-terminal-settled-js-twice");

      Result next = new Result();
      onUi(() -> module.authenticate("next", "New test fixture", "Cancel", next.promise));
      check(next.error == null && next.settlements.get() == 0, "retry-after-terminal-not-accepted");
      onUi(() -> module.cancel("first"));
      check(next.settlements.get() == 0, "stale-cancel-ended-new-request");
      onUi(() -> module.onHostPause());
      check(Boolean.FALSE.equals(next.value) && next.settlements.get() == 1, "background-must-cancel");
      onUi(() -> module.onHostResume());
      Result backgroundRetry = new Result();
      onUi(() -> module.authenticate("background-retry", "Retry fixture", "Cancel", backgroundRetry.promise));
      check("session-auth-unavailable".equals(backgroundRetry.error), "background-retry-before-terminal");
      awaitCallback();
      drainCallbacks();
      check(next.settlements.get() == 1, "background-terminal-settled-js-twice");

      Result last = new Result();
      onUi(() -> module.authenticate("last", "Final test fixture", "Cancel", last.promise));
      check(last.error == null && last.settlements.get() == 0, "fresh-attempt-after-background-terminal");
      onUi(() -> module.cancel("last"));
      awaitCallback();
      drainCallbacks();
      check(Boolean.FALSE.equals(last.value) && last.settlements.get() == 1, "final-cancel-failed");
      success = true;
      detail = "cancel-immediate-retry, delayed-real-androidx-terminal, stale-id, background-retry: PASS";
    } catch (Throwable failure) {
      detail = failure.toString();
    } finally {
      onUi(() -> {
        if (module != null) module.invalidate();
        if (context != null) context.onHostDestroy();
        if (activity != null) activity.finish();
      });
      Bundle result = new Bundle();
      result.putBoolean("success", success);
      result.putString("stream", "\nSESSION_AUTH_NATIVE: " + detail + "\n");
      finish(success ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
    }
  }

  private void onUi(Runnable action) {
    runOnMainSync(action);
    waitForIdleSync();
  }

  private void awaitCallback() throws Exception {
    long deadline = android.os.SystemClock.uptimeMillis() + 10000;
    while (callbacks.isEmpty() && android.os.SystemClock.uptimeMillis() < deadline) {
      waitForIdleSync();
      Thread.sleep(20);
    }
    check(!callbacks.isEmpty(), "real-androidx-terminal-timeout");
  }

  private void drainCallbacks() {
    onUi(() -> {
      Runnable callback;
      while ((callback = callbacks.poll()) != null) callback.run();
    });
    waitForIdleSync();
  }

  private static void check(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
}
