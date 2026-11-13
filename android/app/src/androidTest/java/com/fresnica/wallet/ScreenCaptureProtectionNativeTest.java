package com.fresnica.wallet;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import com.facebook.react.bridge.BridgeReactContext;
import com.facebook.react.bridge.Promise;
import java.lang.reflect.Proxy;

/** Actual window-flag/lifecycle mechanism, without opening wallet UI or credentials. */
public final class ScreenCaptureProtectionNativeTest extends Instrumentation {
  @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
  @Override public void onStart() {
    boolean success = false;
    String detail = "";
    Activity activity = null;
    try {
      Intent intent = new Intent(getTargetContext(), SessionAuthenticationFixtureActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity = startActivitySync(intent);
      Activity host = activity;
      ScreenCaptureProtectionModule[] module = new ScreenCaptureProtectionModule[1];
      onUi(() -> {
        BridgeReactContext context = new BridgeReactContext(getTargetContext());
        context.onHostResume(host);
        module[0] = new ScreenCaptureProtectionModule(context);
      });
      Promise promise = (Promise) Proxy.newProxyInstance(Promise.class.getClassLoader(), new Class<?>[]{Promise.class}, (proxy, method, args) -> null);
      onUi(() -> module[0].setProtected(true, promise));
      assertSecure(host, true, "explicit-protection");
      onUi(() -> module[0].setProtected(false, promise));
      assertSecure(host, false, "foreground-opt-in");
      onUi(() -> module[0].onHostPause());
      assertSecure(host, true, "background-reprotects");
      onUi(() -> module[0].setProtected(false, promise));
      assertSecure(host, true, "background-disable-refused");
      onUi(() -> module[0].onHostResume());
      assertSecure(host, true, "resume-starts-protected");
      onUi(() -> module[0].setProtected(false, promise));
      assertSecure(host, false, "fresh-foreground-policy");
      onUi(() -> module[0].onHostDestroy());
      assertSecure(host, true, "destroy-reprotects");
      onUi(() -> module[0].onHostResume());
      onUi(() -> module[0].setProtected(false, promise));
      onUi(() -> module[0].invalidate());
      assertSecure(host, true, "bridge-invalidation-reprotects");
      success = true;
      detail = "foreground enable/disable, background refusal, resume and destruction passed";
    } catch (Throwable error) { detail = error.toString(); }
    finally {
      Activity host = activity;
      if (host != null) runOnMainSync(host::finish);
      Bundle result = new Bundle(); result.putBoolean("success", success); result.putString("stream", "\nSCREEN_CAPTURE_NATIVE: " + detail + "\n");
      finish(success ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
    }
  }
  private void onUi(Runnable action) {
    java.util.concurrent.atomic.AtomicReference<Throwable> failure = new java.util.concurrent.atomic.AtomicReference<>();
    runOnMainSync(() -> { try { action.run(); } catch (Throwable error) { failure.set(error); } });
    waitForIdleSync();
    if (failure.get() != null) throw new AssertionError(failure.get());
  }
  private void assertSecure(Activity activity, boolean expected, String message) {
    java.util.concurrent.atomic.AtomicBoolean actual = new java.util.concurrent.atomic.AtomicBoolean();
    onUi(() -> actual.set(secure(activity)));
    check(actual.get() == expected, message);
  }
  private static boolean secure(Activity activity) { return (activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0; }
  private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
}
