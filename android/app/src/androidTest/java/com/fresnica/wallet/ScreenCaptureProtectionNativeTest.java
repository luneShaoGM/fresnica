package com.fresnica.wallet;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import com.facebook.react.bridge.BridgeReactContext;
import com.facebook.react.bridge.Promise;
import com.facebook.react.uimanager.DisplayMetricsHolder;
import com.facebook.react.uimanager.StateWrapper;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.views.modal.ReactModalHostView;
import java.lang.reflect.Proxy;

/** Actual window-flag/lifecycle mechanism, without opening wallet UI or credentials. */
public final class ScreenCaptureProtectionNativeTest extends Instrumentation {
  @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
  @Override public void onStart() {
    boolean success = false;
    String detail = "";
    Activity activity = null;
    ReactModalHostView[] modal = new ReactModalHostView[1];
    try {
      Intent intent = new Intent(getTargetContext(), SessionAuthenticationFixtureActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity = startActivitySync(intent);
      Activity host = activity;
      ScreenCaptureProtectionModule[] module = new ScreenCaptureProtectionModule[1];
      BridgeReactContext[] context = new BridgeReactContext[1];
      onUi(() -> {
        DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(host);
        context[0] = new BridgeReactContext(getTargetContext());
        context[0].onHostResume(host);
        module[0] = new ScreenCaptureProtectionModule(context[0]);
      });
      Promise promise = (Promise) Proxy.newProxyInstance(Promise.class.getClassLoader(), new Class<?>[]{Promise.class}, (proxy, method, args) -> null);
      onUi(() -> module[0].setProtected(true, promise));
      assertSecure(host, true, "explicit-protection");
      onUi(() -> module[0].setProtected(false, promise));
      assertSecure(host, false, "foreground-opt-in");
      onUi(() -> {
        modal[0] = new ReactModalHostView(new ThemedReactContext(context[0], host, "capture-test", -1));
        // No JS surface is mounted; layout state is unrelated to the actual Dialog window under test.
        modal[0].setStateWrapper((StateWrapper) Proxy.newProxyInstance(StateWrapper.class.getClassLoader(), new Class<?>[]{StateWrapper.class}, (proxy, method, args) -> null));
        modal[0].setOnRequestCloseListener(dialog -> {});
        modal[0].showOrUpdate();
        check(modal[0].getDialog().isShowing(), "real-rn-modal-visible");
        check(modal[0].getDialog().getWindow() != host.getWindow(), "independent-dialog-window");
      });
      Window dialogWindow = modal[0].getDialog().getWindow();
      assertSecure(dialogWindow, true, "dialog-created-during-opt-out-protected");
      assertSecure(host, false, "dialog-does-not-change-main-opt-out");
      onUi(() -> module[0].onHostPause());
      onUi(() -> check(modal[0].getDialog().isShowing(), "dialog-remains-open-on-pause"));
      assertSecure(host, true, "background-reprotects");
      assertSecure(dialogWindow, true, "open-dialog-background-protected");
      onUi(() -> module[0].setProtected(false, promise));
      assertSecure(host, true, "background-disable-refused");
      assertSecure(dialogWindow, true, "dialog-background-disable-refused");
      onUi(() -> module[0].onHostResume());
      assertSecure(host, true, "resume-starts-protected");
      onUi(() -> module[0].setProtected(false, promise));
      assertSecure(host, false, "fresh-foreground-policy");
      assertSecure(dialogWindow, true, "dialog-resume-stays-protected");
      onUi(() -> { modal[0].onDropInstance(); modal[0].showOrUpdate(); });
      dialogWindow = modal[0].getDialog().getWindow();
      assertSecure(dialogWindow, true, "reopened-dialog-during-opt-out-protected");
      onUi(() -> module[0].setProtected(true, promise));
      assertSecure(dialogWindow, true, "explicit-protection-includes-dialog");
      onUi(() -> module[0].onHostDestroy());
      assertSecure(host, true, "destroy-reprotects");
      onUi(() -> module[0].onHostResume());
      onUi(() -> module[0].setProtected(false, promise));
      onUi(() -> {
        module[0].invalidate();
        modal[0].onDropInstance();
        modal[0].showOrUpdate();
        check((modal[0].getDialog().getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0, "dialog-created-before-invalidation-protect-task");
      });
      assertSecure(host, true, "bridge-invalidation-reprotects");
      assertSecure(dialogWindow, true, "open-dialog-invalidation-protected");
      assertSecure(modal[0].getDialog().getWindow(), true, "new-dialog-invalidation-protected");
      success = true;
      detail = "Activity and real RN Modal: foreground opt-out, dialog creation/reopen, background refusal, resume, explicit protection and invalidation passed";
    } catch (Throwable error) { detail = error.toString(); }
    finally {
      if (modal[0] != null) runOnMainSync(() -> modal[0].onDropInstance());
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
    assertSecure(activity.getWindow(), expected, message);
  }
  private void assertSecure(Window window, boolean expected, String message) {
    java.util.concurrent.atomic.AtomicBoolean actual = new java.util.concurrent.atomic.AtomicBoolean();
    onUi(() -> actual.set((window.getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0));
    check(actual.get() == expected, message);
  }
  private static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
}
