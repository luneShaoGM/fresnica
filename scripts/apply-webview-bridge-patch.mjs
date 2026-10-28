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
  const android = readFileSync(resolve(root, edits[0].file), 'utf8');
  const apple = readFileSync(resolve(root, edits[6].file), 'utf8');
  if (!android.includes('onVerifiedMessage') || !apple.includes('FresnicaVerifiedHttpsOrigin')) {
    console.error('WebView bridge patch did not land.');
    process.exit(1);
  }
}
