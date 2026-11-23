package com.fresnica.wallet;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.facebook.react.bridge.BridgeReactContext;
import com.reactnativecommunity.webview.RNCWebView;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Native clock mechanism only; no wallet session or notification is posted. */
public final class DappNotificationClockTest extends Instrumentation {
  @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }

  @Override public void onStart() {
    Activity activity = null;
    WebView[] page = new WebView[1];
    boolean success = false;
    String detail;
    try {
      Intent intent = new Intent(getTargetContext(), DappBrowserFixtureActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity = startActivitySync(intent);
      Activity host = activity;
      CountDownLatch loaded = new CountDownLatch(1);
      runOnMainSync(() -> {
        page[0] = new WebView(host);
        page[0].getSettings().setJavaScriptEnabled(true);
        page[0].addJavascriptInterface(new RNCWebView.FresnicaNotificationClock(), "FresnicaNotificationClock");
        page[0].setWebViewClient(new WebViewClient() {
          @Override public void onPageFinished(WebView view, String url) { loaded.countDown(); }
        });
        host.setContentView(page[0]);
        page[0].loadDataWithBaseURL("https://clock.fixture.example/", "<html></html>", "text/html", "UTF-8", null);
      });
      if (!loaded.await(10, TimeUnit.SECONDS)) throw new AssertionError("page-load-timeout");
      DappNotificationModule module = new DappNotificationModule(new BridgeReactContext(getTargetContext()));
      double previous = -1;
      for (int i = 0; i < 2; i++) {
        CountDownLatch read = new CountDownLatch(1);
        double[] value = new double[1];
        double before = module.monotonicTime();
        runOnMainSync(() -> page[0].evaluateJavascript("window.FresnicaNotificationClock.now()", result -> {
          try { value[0] = Double.parseDouble(result); }
          catch (RuntimeException error) { value[0] = Double.NaN; }
          read.countDown();
        }));
        if (!read.await(10, TimeUnit.SECONDS)) throw new AssertionError("clock-read-timeout");
        double after = module.monotonicTime();
        if (!(value[0] >= before && value[0] <= after && value[0] > previous)) {
          throw new AssertionError("WebView and wallet clock differ");
        }
        previous = value[0];
        SystemClock.sleep(20);
      }
      success = true;
      detail = "WebView JavascriptInterface and wallet module read the same elapsedRealtime domain";
    } catch (Throwable error) { detail = error.toString(); }
    finally {
      Activity host = activity;
      runOnMainSync(() -> {
        if (page[0] != null) page[0].destroy();
        if (host != null) host.finish();
      });
    }
    Bundle result = new Bundle();
    result.putBoolean("success", success);
    result.putString("stream", "\nDAPP_NOTIFICATION_CLOCK: " + detail + "\n");
    finish(success ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
  }
}
