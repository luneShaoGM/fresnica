import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Fresnica keeps the wallet bridge on the stock react-native-webview package,
// but only a verified main-frame HTTPS origin may reach JavaScript. npm install
// restores the package, so this script reapplies the same source edit.
const root = resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');
const marker = 'Fresnica verified main-frame HTTPS bridge';

const edits = [
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java',
    applied: 'Fresnica denies browser device permissions',
    from: `    @Override
    public void onPermissionRequest(final PermissionRequest request) {

        grantedPermissions = new ArrayList<>();

        ArrayList<String> requestedAndroidPermissions = new ArrayList<>();
        for (String requestedResource : request.getResources()) {
            String androidPermission = null;

            if (requestedResource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                androidPermission = Manifest.permission.RECORD_AUDIO;
            } else if (requestedResource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                androidPermission = Manifest.permission.CAMERA;
            } else if(requestedResource.equals(PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID)) {
                if (mAllowsProtectedMedia) {
                  grantedPermissions.add(requestedResource);
                } else {
                  /**
                   * Legacy handling (Kept in case it was working under some conditions (given Android version or something))
                   *
                   * Try to ask user to grant permission using Activity.requestPermissions
                   *
                   * Find more details here: https://github.com/react-native-webview/react-native-webview/pull/2732
                   */
                  androidPermission = PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID;
                }            }
            // TODO: RESOURCE_MIDI_SYSEX, RESOURCE_PROTECTED_MEDIA_ID.
            if (androidPermission != null) {
                if (ContextCompat.checkSelfPermission(this.mWebView.getThemedReactContext(), androidPermission) == PackageManager.PERMISSION_GRANTED) {
                    grantedPermissions.add(requestedResource);
                } else {
                    requestedAndroidPermissions.add(androidPermission);
                }
            }
        }

        // If all the permissions are already granted, send the response to the WebView synchronously
        if (requestedAndroidPermissions.isEmpty()) {
            request.grant(grantedPermissions.toArray(new String[0]));
            grantedPermissions = null;
            return;
        }

        // Otherwise, ask to Android System for native permissions asynchronously

        this.permissionRequest = request;

        requestPermissions(requestedAndroidPermissions);
    }


`,
    to: `    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        // Fresnica denies browser device permissions until per-origin S21 consent exists.
        // An app-level CAMERA grant for the native scanner is not a website grant.
        request.deny();
    }


`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'import java.util.Locale;',
    from: `import java.util.List;
import java.util.Map;
import java.util.Set;`,
    to: `import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'Fresnica verified main-frame HTTPS bridge',
    from: `    protected static final String JAVASCRIPT_INTERFACE = "ReactNativeWebView";`,
    to: `    protected static final String JAVASCRIPT_INTERFACE = "ReactNativeWebView";
    // ${marker}
    private static final int MAX_BRIDGE_MESSAGE_LENGTH = 262144;`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'onVerifiedMessage(payload, origin)',
    from: `              public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message, @NonNull Uri sourceOrigin, boolean isMainFrame, @NonNull JavaScriptReplyProxy replyProxy) {
                RNCWebView.this.onMessage(message.getData(), sourceOrigin.toString());
              }`,
    to: `              public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message, @NonNull Uri sourceOrigin, boolean isMainFrame, @NonNull JavaScriptReplyProxy replyProxy) {
                if (!isMainFrame || message.getType() != WebMessageCompat.TYPE_STRING) {
                  return;
                }
                String payload = message.getData();
                if (payload == null || payload.isEmpty() || payload.length() > MAX_BRIDGE_MESSAGE_LENGTH) {
                  return;
                }
                String origin = verifiedHttpsOrigin(sourceOrigin);
                if (origin == null) {
                  return;
                }
                RNCWebView.this.onVerifiedMessage(payload, origin);
              }`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'wallet bridge messages are disabled',
    from: `        } else {
          if (fallbackBridge == null) {
            fallbackBridge = new RNCWebViewBridge(webView);
            addJavascriptInterface(fallbackBridge, JAVASCRIPT_INTERFACE);
          }
        }`,
    to: `        } else {
          // A JavascriptInterface fallback reports the main document URL, so a
          // child frame can impersonate it. Leave the bridge disabled instead.
          FLog.w("RNCWebView", "WebMessageListener is unavailable; wallet bridge messages are disabled");
        }`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'private static String verifiedHttpsOrigin',
    from: `    public void onMessage(String message, String sourceUrl) {`,
    to: `    @Nullable
    private static String verifiedHttpsOrigin(@Nullable Uri uri) {
        if (uri == null || uri.getScheme() == null || uri.getHost() == null) {
            return null;
        }
        if (!"https".equals(uri.getScheme().toLowerCase(Locale.ROOT))) {
            return null;
        }
        String host = uri.getHost().toLowerCase(Locale.ROOT);
        if (host.isEmpty()) {
            return null;
        }
        int port = uri.getPort();
        if (port == -1 || port == 443) {
            return "https://" + host;
        }
        return "https://" + host + ":" + port;
    }

    public void onVerifiedMessage(String message, String sourceOrigin) {
        deliverMessage(message, sourceOrigin, sourceOrigin, true);
    }

    public void onMessage(String message, String sourceUrl) {
        deliverMessage(message, sourceUrl, null, false);
    }

    private void deliverMessage(String message, String sourceUrl, @Nullable String sourceOrigin, boolean mainFrame) {`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'data.putString("sourceOrigin", sourceOrigin)',
    from: `                    WritableMap data = mRNCWebViewClient.createWebViewEvent(webView, sourceUrl);
                    data.putString("data", message);`,
    to: `                    WritableMap data = mRNCWebViewClient.createWebViewEvent(webView, sourceUrl);
                    data.putString("data", message);
                    if (sourceOrigin != null) {
                        data.putString("sourceOrigin", sourceOrigin);
                        data.putBoolean("isMainFrame", mainFrame);
                    }`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java',
    applied: 'import java.net.URISyntaxException;',
    from: 'import java.util.concurrent.atomic.AtomicReference;',
    to: `import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java',
    applied: 'Fresnica native public HTTPS navigation gate',
    from: `    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        final RNCWebView rncWebView = (RNCWebView) view;`,
    to: `    // Fresnica native public HTTPS navigation gate (link/GET defense only).
    // Defense in depth only: Android embedded dApp WebViews are disabled
    // because this callback cannot preflight main-frame POST navigations.
    // Never treat the 250ms JavaScript wait as a URL security barrier.
    private static boolean isPublicNavigation(String url) {
        if (url == null || url.isEmpty() || url.length() > 2048) return false;
        if ("about:blank".equals(url)) return true;
        try {
            URI parsed = new URI(url);
            if (!"https".equalsIgnoreCase(parsed.getScheme()) || parsed.getRawUserInfo() != null ||
                parsed.getPort() > 65535) return false;
            String host = parsed.getHost();
            if (host == null) return false;
            host = host.toLowerCase(Locale.ROOT);
            if (host.endsWith(".") || host.indexOf(':') >= 0 || host.matches("[0-9.]+")) return false;
            String[] labels = host.split("[.]", -1);
            if (labels.length < 2) return false;
            for (String label : labels) {
                if (label.length() > 63 || !label.matches("[a-z0-9](?:[a-z0-9-]*[a-z0-9])?") ||
                    label.equals("localhost")) return false;
            }
            String suffix = labels[labels.length - 1];
            return !suffix.equals("localhost") && !suffix.equals("local") &&
                !suffix.equals("internal") && !suffix.equals("invalid") &&
                !suffix.equals("test") && !suffix.equals("onion");
        } catch (URISyntaxException error) {
            return false;
        }
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (!isPublicNavigation(url)) return true;
        final RNCWebView rncWebView = (RNCWebView) view;`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java',
    applied: 'event.putBoolean("isDocumentStart", false);',
    from: `      ((RNCWebView) webView).dispatchEvent(
        webView,
        new TopLoadingStartEvent(
          RNCWebViewWrapper.getReactTagFromWebView(webView),
          createWebViewEvent(webView, url)));`,
    to: `      // History API mutations update navigation UI but are not new documents.
      WritableMap event = createWebViewEvent(webView, url);
      event.putBoolean("isDocumentStart", false);
      ((RNCWebView) webView).dispatchEvent(
        webView,
        new TopLoadingStartEvent(
          RNCWebViewWrapper.getReactTagFromWebView(webView),
          event));`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java',
    applied: 'event.putBoolean("isDocumentStart", true);',
    from: `      RNCWebView reactWebView = (RNCWebView) webView;
      reactWebView.callInjectedJavaScriptBeforeContentLoaded();
    }`,
    to: `      RNCWebView reactWebView = (RNCWebView) webView;
      WritableMap event = createWebViewEvent(webView, url);
      event.putBoolean("isDocumentStart", true);
      reactWebView.dispatchEvent(webView, new TopLoadingStartEvent(
        RNCWebViewWrapper.getReactTagFromWebView(webView), event));
      reactWebView.callInjectedJavaScriptBeforeContentLoaded();
    }`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'static NSString *FresnicaVerifiedHttpsOrigin',
    from: `@implementation RNCWebViewImpl`,
    to: `// ${marker}
static NSString *FresnicaVerifiedHttpsOrigin(NSURL *url) {
  if (url == nil || url.scheme == nil || url.host == nil) {
    return nil;
  }
  if (![url.scheme.lowercaseString isEqualToString:@"https"]) {
    return nil;
  }
  NSString *host = url.host.lowercaseString;
  if (host.length == 0) {
    return nil;
  }
  if (url.port == nil || url.port.integerValue == 443) {
    return [NSString stringWithFormat:@"https://%@", host];
  }
  return [NSString stringWithFormat:@"https://%@:%@", host, url.port];
}

@implementation RNCWebViewImpl`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: '@"sourceOrigin": origin',
    from: `  } else if ([message.name isEqualToString:MessageHandlerName]) {
    if (_onMessage) {
      NSMutableDictionary<NSString *, id> *event = [self baseEvent];
      [event addEntriesFromDictionary: @{@"data": message.body}];
      [event addEntriesFromDictionary: @{@"url": message.frameInfo.request.URL.absoluteString}];
      _onMessage(event);
    }
  }
}`,
    to: `  } else if ([message.name isEqualToString:MessageHandlerName]) {
    if (_onMessage) {
      if (!message.frameInfo.isMainFrame || ![message.body isKindOfClass:[NSString class]]) {
        return;
      }
      NSString *payload = (NSString *)message.body;
      if (payload.length == 0 || payload.length > 16384) {
        return;
      }
      NSString *origin = FresnicaVerifiedHttpsOrigin(message.frameInfo.request.URL);
      if (origin == nil) {
        return;
      }
      NSMutableDictionary<NSString *, id> *event = [self baseEvent];
      [event addEntriesFromDictionary: @{@"data": payload}];
      [event addEntriesFromDictionary: @{@"url": message.frameInfo.request.URL.absoluteString}];
      [event addEntriesFromDictionary: @{@"sourceOrigin": origin, @"isMainFrame": @YES}];
      _onMessage(event);
    }
  }
}`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'payload.length > 262144',
    from: 'payload.length > 16384',
    to: 'payload.length > 262144',
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'MAX_BRIDGE_MESSAGE_LENGTH = 262144',
    from: 'MAX_BRIDGE_MESSAGE_LENGTH = 16384',
    to: 'MAX_BRIDGE_MESSAGE_LENGTH = 262144',
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'Fresnica native SEP-53 reply registry',
    from: '    private static final int MAX_BRIDGE_MESSAGE_LENGTH = 262144;',
    to: `    private static final int MAX_BRIDGE_MESSAGE_LENGTH = 262144;
    // Fresnica native SEP-53 reply registry. Accessed only on the WebView UI thread.
    private static final String SEP53_PREFIX = "fresnica-sep53:";
    private final java.util.LinkedHashMap<String, JavaScriptReplyProxy> sep53Replies = new java.util.LinkedHashMap<>();

    public void clearFresnicaSep53Replies() {
        sep53Replies.clear();
    }

    public boolean handleFresnicaSep53Reply(@Nullable String command) {
        if (command == null || !command.startsWith(SEP53_PREFIX)) return false;
        int separator = command.indexOf(':', SEP53_PREFIX.length());
        if (separator == SEP53_PREFIX.length() + 36 && command.length() <= 2048) {
            JavaScriptReplyProxy channel = sep53Replies.remove(command.substring(SEP53_PREFIX.length(), separator));
            if (channel != null) channel.postMessage(command.substring(separator + 1));
        }
        return true; // A missing/expired reply never falls back to global JavaScript.
    }`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'sep53Replies.put(replyId, replyProxy)',
    from: '                RNCWebView.this.onVerifiedMessage(payload, origin);',
    to: `                if (payload.startsWith(SEP53_PREFIX)) {
                  if (sep53Replies.size() >= 128) sep53Replies.remove(sep53Replies.keySet().iterator().next());
                  String replyId = java.util.UUID.randomUUID().toString();
                  sep53Replies.put(replyId, replyProxy);
                  deliverMessage(payload.substring(SEP53_PREFIX.length()), origin, origin, true, replyId);
                } else {
                  RNCWebView.this.onVerifiedMessage(payload, origin);
                }`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: '@Nullable String sep53ReplyId',
    from: '    private void deliverMessage(String message, String sourceUrl, @Nullable String sourceOrigin, boolean mainFrame) {',
    to: `    private void deliverMessage(String message, String sourceUrl, @Nullable String sourceOrigin, boolean mainFrame) {
        deliverMessage(message, sourceUrl, sourceOrigin, mainFrame, null);
    }

    private void deliverMessage(String message, String sourceUrl, @Nullable String sourceOrigin, boolean mainFrame,
        @Nullable String sep53ReplyId) {`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: 'data.putString("sep53ReplyId", sep53ReplyId)',
    from: '                    if (sourceOrigin != null) {',
    to: `                    if (sep53ReplyId != null) data.putString("sep53ReplyId", sep53ReplyId);
                    if (sourceOrigin != null) {`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java',
    applied: 'reactWebView.clearFresnicaSep53Replies();',
    from: '      event.putBoolean("isDocumentStart", true);',
    to: `      reactWebView.clearFresnicaSep53Replies();
      event.putBoolean("isDocumentStart", true);`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    applied: '        clearFresnicaSep53Replies();',
    from: '    public void destroy() {',
    to: `    public void destroy() {
        clearFresnicaSep53Replies();`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewManagerImpl.kt',
    applied: 'webView.handleFresnicaSep53Reply(args.getString(0))',
    from: '        "postMessage" -> try {',
    to: `        "postMessage" -> try {
          if (webView.handleFresnicaSep53Reply(args.getString(0))) return`,
  },
  {
    file: 'node_modules/react-native-webview/android/src/newarch/com/reactnativecommunity/webview/RNCWebViewManager.java',
    applied: 'view.getWebView().handleFresnicaSep53Reply(data)',
    from: `  public void postMessage(RNCWebViewWrapper view, String data) {`,
    to: `  public void postMessage(RNCWebViewWrapper view, String data) {
      // Fabric dispatches here without the legacy manager command handler.
      if (view.getWebView().handleFresnicaSep53Reply(data)) return;`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'FresnicaSep53ReplyHandler : NSObject',
    from: '@interface RNCWebViewImpl () <WKUIDelegate',
    to: `typedef void (^FresnicaSep53Reply)(id _Nullable, NSString * _Nullable);
static NSString *const FresnicaSep53HandlerName = @"FresnicaSep53";
static NSString *const FresnicaSep53Prefix = @"fresnica-sep53:";

@interface FresnicaSep53ReplyHandler : NSObject <WKScriptMessageHandlerWithReply>
@property (nonatomic, copy) void (^receive)(WKScriptMessage *, FresnicaSep53Reply);
@end

@implementation FresnicaSep53ReplyHandler
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message replyHandler:(FresnicaSep53Reply)reply {
  if (self.receive) self.receive(message, reply);
  else reply(nil, @"Wallet unavailable");
}
@end

@interface RNCWebViewImpl () <WKUIDelegate`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: '*fresnicaSep53Replies;',
    from: '@property (nonatomic, strong) WKUserScript *postMessageScript;',
    to: `@property (nonatomic, strong) WKUserScript *postMessageScript;
@property (nonatomic, strong) NSMutableDictionary<NSString *, FresnicaSep53Reply> *fresnicaSep53Replies;`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'fresnicaReceiveSep53:(WKScriptMessage *)message',
    from: '- (void)postMessage:(NSString *)message',
    to: `- (void)fresnicaReceiveSep53:(WKScriptMessage *)message reply:(FresnicaSep53Reply)reply
{
  NSString *origin = FresnicaVerifiedHttpsOrigin(message.frameInfo.request.URL);
  if (!_onMessage || !message.frameInfo.isMainFrame || !origin ||
      ![message.body isKindOfClass:[NSString class]] || [message.body length] == 0 ||
      [message.body length] > 262144 || self.fresnicaSep53Replies.count >= 128) {
    reply(nil, @"Wallet request unavailable");
    return;
  }
  if (!self.fresnicaSep53Replies) self.fresnicaSep53Replies = [NSMutableDictionary new];
  NSString *replyId = NSUUID.UUID.UUIDString;
  self.fresnicaSep53Replies[replyId] = [reply copy];
  __weak typeof(self) weakSelf = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 120 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    typeof(self) view = weakSelf;
    FresnicaSep53Reply expired = view.fresnicaSep53Replies[replyId];
    [view.fresnicaSep53Replies removeObjectForKey:replyId];
    if (expired) expired(nil, @"Wallet request expired");
  });
  NSMutableDictionary<NSString *, id> *event = [self baseEvent];
  [event addEntriesFromDictionary:@{@"data": message.body, @"url": message.frameInfo.request.URL.absoluteString,
      @"sourceOrigin": origin, @"isMainFrame": @YES, @"sep53ReplyId": replyId}];
  _onMessage(event);
}

- (void)postMessage:(NSString *)message`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'NSTimeInterval replyExpiresAt',
    from: '  self.fresnicaSep53Replies[replyId] = [reply copy];',
    to: `  self.fresnicaSep53Replies[replyId] = [reply copy];
  NSTimeInterval replyExpiresAt = (NSDate.date.timeIntervalSince1970 + 120.0) * 1000.0;`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: '@"sep53ReplyExpiresAt": @(replyExpiresAt)',
    from: '@"sourceOrigin": origin, @"isMainFrame": @YES, @"sep53ReplyId": replyId}',
    to: '@"sourceOrigin": origin, @"isMainFrame": @YES, @"sep53ReplyId": replyId, @"sep53ReplyExpiresAt": @(replyExpiresAt)}',
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'if ([message hasPrefix:FresnicaSep53Prefix])',
    from: '  NSDictionary *eventInitDict = @{@"data": message};',
    to: `  if ([message hasPrefix:FresnicaSep53Prefix]) {
    NSUInteger start = FresnicaSep53Prefix.length;
    if (message.length <= 2048) {
      NSRange separator = [message rangeOfString:@":" options:0 range:NSMakeRange(start, message.length - start)];
      if (separator.location == start + 36) {
        NSString *replyId = [message substringWithRange:NSMakeRange(start, 36)];
        FresnicaSep53Reply reply = self.fresnicaSep53Replies[replyId];
        [self.fresnicaSep53Replies removeObjectForKey:replyId];
        if (reply) reply([message substringFromIndex:separator.location + 1], nil);
      }
    }
    return;
  }
  NSDictionary *eventInitDict = @{@"data": message};`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'addScriptMessageHandlerWithReply:handler',
    from: '- (void)resetupScripts:(WKWebViewConfiguration *)wkWebViewConfig {',
    to: `- (void)resetupScripts:(WKWebViewConfiguration *)wkWebViewConfig {
  [wkWebViewConfig.userContentController removeScriptMessageHandlerForName:FresnicaSep53HandlerName contentWorld:WKContentWorld.pageWorld];
  if (_messagingEnabled) {
    FresnicaSep53ReplyHandler *handler = [FresnicaSep53ReplyHandler new];
    __weak typeof(self) weakSelf = self;
    handler.receive = ^(WKScriptMessage *message, FresnicaSep53Reply reply) {
      typeof(self) view = weakSelf;
      if (view) [view fresnicaReceiveSep53:message reply:reply];
      else reply(nil, @"Wallet unavailable");
    };
    [wkWebViewConfig.userContentController addScriptMessageHandlerWithReply:handler
          contentWorld:WKContentWorld.pageWorld name:FresnicaSep53HandlerName];
  }`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: 'for (FresnicaSep53Reply reply in self.fresnicaSep53Replies.allValues)',
    from: '    [_webView.configuration.userContentController removeScriptMessageHandlerForName:HistoryShimName];',
    to: `    [_webView.configuration.userContentController removeScriptMessageHandlerForName:FresnicaSep53HandlerName contentWorld:WKContentWorld.pageWorld];
    for (FresnicaSep53Reply reply in self.fresnicaSep53Replies.allValues) reply(nil, @"Wallet unavailable");
    [self.fresnicaSep53Replies removeAllObjects];
    [_webView.configuration.userContentController removeScriptMessageHandlerForName:HistoryShimName];`,
  },
  {
    file: 'node_modules/react-native-webview/src/RNCWebViewNativeComponent.ts',
    applied: 'sep53ReplyId: string;',
    from: `  data: string;
}>;
export type WebViewOpenWindowEvent`,
    to: `  data: string;
  sourceOrigin: string;
  isMainFrame: boolean;
  sep53ReplyId: string;
}>;
export type WebViewOpenWindowEvent`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebView.mm',
    applied: '.sep53ReplyId = nullSafeString',
    from: `                    .data = nullSafeString([dictionary valueForKey:@"data"])
                };
                webViewEventEmitter->onMessage(data);`,
    to: `                    .data = nullSafeString([dictionary valueForKey:@"data"]),
                    .sourceOrigin = nullSafeString([dictionary valueForKey:@"sourceOrigin"]),
                    .isMainFrame = static_cast<bool>([[dictionary valueForKey:@"isMainFrame"] boolValue]),
                    .sep53ReplyId = nullSafeString([dictionary valueForKey:@"sep53ReplyId"])
                };
                webViewEventEmitter->onMessage(data);`,
  },
  {
    file: 'node_modules/react-native-webview/src/RNCWebViewNativeComponent.ts',
    applied: 'sep53ReplyExpiresAt: Double;',
    from: '  sep53ReplyId: string;',
    to: `  sep53ReplyId: string;
  sep53ReplyExpiresAt: Double;`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebView.mm',
    applied: '.sep53ReplyExpiresAt = ',
    from: '.sep53ReplyId = nullSafeString([dictionary valueForKey:@"sep53ReplyId"])',
    to: `.sep53ReplyId = nullSafeString([dictionary valueForKey:@"sep53ReplyId"]),
                    .sep53ReplyExpiresAt = [[dictionary valueForKey:@"sep53ReplyExpiresAt"] doubleValue]`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebViewImpl.m',
    applied: '@"sep53ReplyExpired": @YES',
    from: `    [view.fresnicaSep53Replies removeObjectForKey:replyId];
    if (expired) expired(nil, @"Wallet request expired");`,
    to: `    if (!expired) return;
    [view.fresnicaSep53Replies removeObjectForKey:replyId];
    // Native callback lifetime must not depend on JavaScript wall time.
    if (view.onMessage) {
      NSMutableDictionary<NSString *, id> *expiryEvent = [view baseEvent];
      [expiryEvent addEntriesFromDictionary:@{@"data": @"{}", @"sourceOrigin": origin,
          @"isMainFrame": @YES, @"sep53ReplyId": replyId, @"sep53ReplyExpired": @YES}];
      view.onMessage(expiryEvent);
    }
    expired(nil, @"Wallet request expired");`,
  },
  {
    file: 'node_modules/react-native-webview/src/RNCWebViewNativeComponent.ts',
    applied: 'sep53ReplyExpired: boolean;',
    from: '  sep53ReplyExpiresAt: Double;',
    to: `  sep53ReplyExpiresAt: Double;
  sep53ReplyExpired: boolean;`,
  },
  {
    file: 'node_modules/react-native-webview/apple/RNCWebView.mm',
    applied: '.sep53ReplyExpired = ',
    from: '.sep53ReplyExpiresAt = [[dictionary valueForKey:@"sep53ReplyExpiresAt"] doubleValue]',
    to: `.sep53ReplyExpiresAt = [[dictionary valueForKey:@"sep53ReplyExpiresAt"] doubleValue],
                    .sep53ReplyExpired = static_cast<bool>([[dictionary valueForKey:@"sep53ReplyExpired"] boolValue])`,
  },
];

let pending = false;
for (const edit of edits) {
  const filePath = resolve(root, edit.file);
  const source = readFileSync(filePath, 'utf8');
  if (source.includes(edit.applied)) continue;
  if (!source.includes(edit.from)) {
    console.error(`WebView bridge patch does not match ${edit.file}`);
    process.exit(1);
  }
  pending = true;
  if (!checkOnly) {
    writeFileSync(filePath, source.replace(edit.from, edit.to));
  }
}

if (pending && checkOnly) {
  console.error('WebView bridge patch is not applied. Run: node scripts/apply-webview-bridge-patch.mjs');
  process.exit(1);
}

if (!checkOnly && pending) {
  const android = readFileSync(
    resolve(
      root,
      'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebView.java',
    ),
    'utf8',
  );
  const apple = readFileSync(resolve(root, 'node_modules/react-native-webview/apple/RNCWebViewImpl.m'), 'utf8');
  if (!android.includes('onVerifiedMessage') || !apple.includes('FresnicaVerifiedHttpsOrigin')) {
    console.error('WebView bridge patch did not land.');
    process.exit(1);
  }
}
