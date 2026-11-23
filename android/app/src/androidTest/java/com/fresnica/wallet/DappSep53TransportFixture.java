package com.fresnica.wallet;

import android.app.Activity;
import android.app.Instrumentation;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.facebook.react.bridge.BridgeReactContext;
import com.facebook.react.bridge.JavaScriptContextHolder;
import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.uimanager.events.EventDispatcherProvider;
import com.facebook.react.uimanager.events.EventDispatcherListener;
import com.facebook.react.uimanager.events.BatchEventDispatchedListener;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.reactnativecommunity.webview.RNCWebView;
import com.reactnativecommunity.webview.RNCWebViewClient;
import com.reactnativecommunity.webview.RNCWebViewManager;
import com.reactnativecommunity.webview.RNCWebViewWrapper;
import java.lang.reflect.Field;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/**
 * Real WebView/native reply-channel transport tests with synthetic response data.
 * The RN event consumer is a recorder; no wallet, signer, or product approval is used.
 */
final class DappSep53TransportFixture implements AutoCloseable {
  private static final String PREFIX = "fresnica-sep53:";
  private static final String CONTROL = "non-sep53-transport-control";
  private final Instrumentation instrumentation;
  private final String origin;
  private final BlockingQueue<NativeRequest> requests = new LinkedBlockingQueue<>();
  private RNCWebViewManager manager;
  private RNCWebViewWrapper wrapper;
  private RNCWebView webview;
  private volatile CountDownLatch finished;
  private volatile CountDownLatch historyUpdated;
  private volatile String expectedUrl;
  private volatile String expectedHistoryUrl;
  private volatile boolean loadFailed;

  DappSep53TransportFixture(Instrumentation instrumentation, Activity activity, String origin) {
    this.instrumentation = instrumentation;
    this.origin = origin;
    instrumentation.runOnMainSync(() -> {
      // No React application or Metro is needed: only the native event consumer is replaced.
      TransportReactContext applicationContext = new TransportReactContext(activity.getApplicationContext());
      ThemedReactContext context = new ThemedReactContext(applicationContext, activity, "Sep53TransportFixture", 1);
      webview = new RNCWebView(context);
      webview.setLayoutParams(new FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      webview.getSettings().setJavaScriptEnabled(true);
      webview.getSettings().setAllowFileAccess(false);
      webview.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
      webview.setWebViewClient(new RNCWebViewClient() {
        @Override public void onPageFinished(WebView view, String url) {
          super.onPageFinished(view, url);
          if (url.equals(expectedUrl) && finished != null) finished.countDown();
        }
        @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
          super.onReceivedError(view, request, error);
          if (request.isForMainFrame()) {
            loadFailed = true;
            if (finished != null) finished.countDown();
          }
        }
      });
      wrapper = new RNCWebViewWrapper(context, webview);
      wrapper.setId(View.generateViewId());
      // This is the compiled Fabric manager, not the legacy Impl.receiveCommand path.
      manager = new RNCWebViewManager();
      manager.setMessagingEnabled(wrapper, true);
      activity.setContentView(wrapper);
    });
  }

  private final RCTEventEmitter eventRecorder = new RCTEventEmitter() {
    @Override public void receiveEvent(int target, String name, WritableMap data) {
      if ("topMessage".equals(name)) {
        requests.offer(new NativeRequest(data));
      } else if ("topLoadingStart".equals(name) && data.hasKey("isDocumentStart") &&
          !data.getBoolean("isDocumentStart") && data.hasKey("url") &&
          data.getString("url").equals(expectedHistoryUrl) && historyUpdated != null) {
        historyUpdated.countDown();
      }
    }
    @Override public void receiveTouches(String name, WritableArray touches, WritableArray changedIndices) {
      throw new AssertionError("unexpected-transport-touch-event");
    }
  };

  void cancelOriginalDocument() throws Exception {
    load("/sep53/cancel");
    NativeRequest request = request("cancel");
    JSONObject response = response("cancel").put("error", "user-declined");
    postReply(request.replyId, response);
    assertNativeReply(response);
    assertNoGlobalReply();
  }

  void successOriginalDocument() throws Exception {
    load("/sep53/success");
    NativeRequest request = request("success");
    JSONObject response = syntheticSuccess("success");
    postReply(request.replyId, response);
    assertNativeReply(response);
    assertNoGlobalReply();
  }

  void handlesFailClosed() throws Exception {
    load("/sep53/handles");
    NativeRequest request = request("handles");
    JSONObject response = syntheticSuccess("handles");
    postReply(request.replyId, response);
    assertNativeReply(response);
    instrumentation.runOnMainSync(() -> {
      manager.postMessage(wrapper, PREFIX + request.replyId + ":" + response);
      manager.postMessage(wrapper, PREFIX + ":" + response);
      manager.postMessage(wrapper, PREFIX + "not-a-handle:" + response);
      manager.postMessage(wrapper, PREFIX + "00000000-0000-0000-0000-000000000000:" + response);
      // An ordinary command still reaches the document, proving the transport is not globally blocked.
      manager.postMessage(wrapper, CONTROL);
    });
    awaitBoolean("window.transportFixture.documentMessages.length===1", "control-message-not-received");
    check(evaluateBoolean("window.transportFixture.nativeReplies.length===1"), "reply-handle-was-reused");
    check(evaluateBoolean("window.transportFixture.documentMessages[0]===" + JSONObject.quote(CONTROL) +
        " && window.transportFixture.windowMessages.length===0"), "invalid-reply-fell-back-to-document");
  }

  void newDocumentExpiresOldReply() throws Exception {
    load("/sep53/original");
    NativeRequest original = request("original");
    check(hasNativeReply(original.replyId), "original-native-reply-not-registered");
    load("/sep53/replaced");
    check(!hasNativeReply(original.replyId), "new-document-did-not-retire-native-reply");
    postReply(original.replyId, syntheticSuccess("original"));
    NativeRequest current = request("current");
    check(!original.replyId.equals(current.replyId), "reply-handle-reused-across-documents");
    JSONObject response = syntheticSuccess("current");
    postReply(current.replyId, response);
    assertNativeReply(response);
    assertNoGlobalReply();
  }

  void historyRetainsCurrentDocument() throws Exception {
    load("/sep53/history-original");
    NativeRequest request = request("history");
    expectedHistoryUrl = origin + "/sep53/history-current";
    historyUpdated = new CountDownLatch(1);
    javascript("history.pushState({}, '', '/sep53/history-current')");
    check(historyUpdated.await(5, TimeUnit.SECONDS), "native-history-update-not-observed");
    JSONObject response = syntheticSuccess("history");
    postReply(request.replyId, response);
    assertNativeReply(response);
    assertNoGlobalReply();
    expectedHistoryUrl = null;
    historyUpdated = null;
  }

  private void load(String path) throws Exception {
    requests.clear();
    loadFailed = false;
    expectedUrl = origin + path;
    finished = new CountDownLatch(1);
    instrumentation.runOnMainSync(() -> webview.loadUrl(expectedUrl));
    check(finished.await(15, TimeUnit.SECONDS), "transport-navigation-timeout");
    check(!loadFailed && evaluateBoolean("document.title==='Local fixture'"), "transport-tls-page-not-loaded");
    check(evaluateBoolean("typeof window.ReactNativeWebView?.addEventListener==='function'"),
        "native-reply-listener-unavailable");
    javascript("window.transportFixture={nativeReplies:[],documentMessages:[],windowMessages:[]};" +
        "window.ReactNativeWebView.addEventListener('message',function(e){" +
          "window.transportFixture.nativeReplies.push(e.data);});" +
        "document.addEventListener('message',function(e){" +
          "window.transportFixture.documentMessages.push(e.data);});" +
        "window.addEventListener('message',function(e){" +
          "window.transportFixture.windowMessages.push(e.data);})");
  }

  private NativeRequest request(String messageId) throws Exception {
    JSONObject payload = new JSONObject()
        .put("source", "FREIGHTER_EXTERNAL_MSG_REQUEST")
        .put("type", "SUBMIT_BLOB")
        .put("messageId", messageId)
        .put("blob", "synthetic transport fixture");
    javascript("window.ReactNativeWebView.postMessage(" + JSONObject.quote(PREFIX + payload) + ")");
    NativeRequest request = requests.poll(5, TimeUnit.SECONDS);
    check(request != null, "verified-native-request-not-received");
    check(request.replyId != null && request.replyId.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}"),
        "native-reply-handle-missing");
    check(request.mainFrame && origin.equals(request.origin), "native-request-origin-mismatch");
    check(payload.toString().equals(request.payload), "native-request-payload-mismatch");
    return request;
  }

  private static JSONObject response(String messageId) throws Exception {
    return new JSONObject().put("source", "FREIGHTER_EXTERNAL_MSG_RESPONSE").put("messageId", messageId);
  }

  private static JSONObject syntheticSuccess(String messageId) throws Exception {
    // Explicitly not a signature: this suite proves native transport, not SEP-53 cryptography.
    return response(messageId).put("signedBlob", "SYNTHETIC_TRANSPORT_ONLY");
  }

  private boolean hasNativeReply(String replyId) throws Exception {
    // Read-only assertion: a dead WebView reply proxy alone cannot prove registry retirement.
    Field replies = RNCWebView.class.getDeclaredField("sep53Replies");
    replies.setAccessible(true);
    boolean[] present = {false};
    instrumentation.runOnMainSync(() -> {
      try {
        present[0] = ((Map<?, ?>) replies.get(webview)).containsKey(replyId);
      } catch (IllegalAccessException error) {
        throw new AssertionError("native-reply-registry-unavailable", error);
      }
    });
    return present[0];
  }

  private void postReply(String replyId, JSONObject response) {
    instrumentation.runOnMainSync(() -> manager.postMessage(wrapper, PREFIX + replyId + ":" + response));
  }

  private void assertNativeReply(JSONObject response) throws Exception {
    awaitBoolean("window.transportFixture.nativeReplies.length===1 && " +
        "window.transportFixture.nativeReplies[0]===" + JSONObject.quote(response.toString()),
        "fabric-native-reply-not-received");
  }

  private void assertNoGlobalReply() throws Exception {
    check(evaluateBoolean("window.transportFixture.documentMessages.length===0 && " +
        "window.transportFixture.windowMessages.length===0"), "native-reply-leaked-to-global-message");
  }

  private void javascript(String script) throws Exception {
    check(evaluateBoolean("(function(){" + script + ";return true;})()"), "fixture-script-failed");
  }

  private void awaitBoolean(String script, String failure) throws Exception {
    long deadline = System.currentTimeMillis() + 5000;
    while (System.currentTimeMillis() < deadline) {
      if (evaluateBoolean(script)) return;
      Thread.sleep(50);
    }
    throw new AssertionError(failure);
  }

  private boolean evaluateBoolean(String script) throws Exception {
    CountDownLatch evaluated = new CountDownLatch(1);
    boolean[] result = {false};
    instrumentation.runOnMainSync(() -> webview.evaluateJavascript(script, value -> {
      result[0] = "true".equals(value);
      evaluated.countDown();
    }));
    check(evaluated.await(3, TimeUnit.SECONDS), "transport-javascript-timeout");
    return result[0];
  }

  @Override public void close() {
    instrumentation.runOnMainSync(() -> webview.destroy());
  }

  private static void check(boolean condition, String failure) {
    if (!condition) throw new AssertionError(failure);
  }

  private final class TransportReactContext extends BridgeReactContext implements EventDispatcherProvider {
    private final JavaScriptContextHolder emptyContext = new JavaScriptContextHolder(0);
    private final EventDispatcher dispatcher = new EventDispatcher() {
      @Override public void dispatchEvent(Event event) {
        if ("topMessage".equals(event.getEventName()) || "topLoadingStart".equals(event.getEventName())) {
          event.dispatch(eventRecorder);
        }
      }
      @Override public void dispatchAllEvents() {}
      @Override public void addListener(EventDispatcherListener listener) {}
      @Override public void removeListener(EventDispatcherListener listener) {}
      @Override public void addBatchEventDispatchedListener(BatchEventDispatchedListener listener) {}
      @Override public void removeBatchEventDispatchedListener(BatchEventDispatchedListener listener) {}
      @Override public void onCatalystInstanceDestroyed() {}
    };
    TransportReactContext(android.content.Context context) { super(context); }
    @Override public <T extends JavaScriptModule> T getJSModule(Class<T> module) { return null; }
    @Override public JavaScriptContextHolder getJavaScriptContextHolder() { return emptyContext; }
    @Override public EventDispatcher getEventDispatcher() { return dispatcher; }
  }

  private static final class NativeRequest {
    final String replyId;
    final String origin;
    final String payload;
    final boolean mainFrame;
    NativeRequest(WritableMap data) {
      replyId = data.hasKey("sep53ReplyId") ? data.getString("sep53ReplyId") : null;
      origin = data.hasKey("sourceOrigin") ? data.getString("sourceOrigin") : null;
      payload = data.hasKey("data") ? data.getString("data") : null;
      mainFrame = data.hasKey("isMainFrame") && data.getBoolean("isMainFrame");
    }
  }
}
