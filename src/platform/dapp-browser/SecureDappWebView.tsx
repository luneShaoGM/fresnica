import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

import type {
  DappBrowserSurfaceHandle,
  DappBrowserSurfaceProps,
} from '../../capabilities/dapp-interaction/browserTransport';
import { readVerifiedDappMessage } from '../../capabilities/dapp-interaction/verifiedDappMessage';

import { buildFreighterInjectionScript } from './freighterInjection';

const styles = StyleSheet.create({ root: { flex: 1 } });

/** Transport-only. URL policy, account/session validation and permission
 * decisions are deliberately owned outside this platform component. */
export const SecureDappWebView = forwardRef<DappBrowserSurfaceHandle, DappBrowserSurfaceProps>(
  function WebViewTransport({ url, shouldLoad, onMessage, onNavigation, onDocumentStart }, ref) {
    const webview = useRef<React.ElementRef<typeof WebView>>(null);
    const injected = useMemo(() => buildFreighterInjectionScript(), []);

    useImperativeHandle(
      ref,
      () => ({
        reply(response) {
          // Deliver an object so the page reads event.data.publicKey and event.data.messagedId.
          const payload = JSON.stringify(response);
          webview.current?.injectJavaScript('window.postMessage(' + payload + ', window.location.origin);true;');
        },
        goBack() {
          webview.current?.goBack();
        },
        goForward() {
          webview.current?.goForward();
        },
        reload() {
          webview.current?.reload();
        },
      }),
      [],
    );

    return (
      <WebView
        ref={webview}
        style={styles.root}
        source={{ uri: url }}
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={event => shouldLoad(event.url)}
        onLoadStart={event => {
          const nativeEvent = event.nativeEvent as typeof event.nativeEvent & { isDocumentStart?: boolean };
          if (nativeEvent.isDocumentStart !== false) onDocumentStart(nativeEvent.url);
        }}
        onNavigationStateChange={event =>
          onNavigation({
            url: event.url,
            canGoBack: event.canGoBack,
            canGoForward: event.canGoForward,
          })
        }
        allowsBackForwardNavigationGestures
        onMessage={event => {
          const nativeEvent = event.nativeEvent as typeof event.nativeEvent & {
            sourceOrigin?: unknown;
            isMainFrame?: unknown;
          };
          const verified = readVerifiedDappMessage({
            data: nativeEvent.data,
            sourceOrigin: nativeEvent.sourceOrigin,
            isMainFrame: nativeEvent.isMainFrame,
          });
          if (!verified) return;
          onMessage(verified.data, verified.origin);
        }}
        injectedJavaScriptBeforeContentLoaded={injected}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        javaScriptEnabled
        domStorageEnabled
        incognito
        cacheEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        mediaPlaybackRequiresUserAction
        mixedContentMode="never"
        allowFileAccess={false}
      />
    );
  },
);
