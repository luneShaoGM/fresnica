import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import WebView from 'react-native-webview';

import type {
  DappBrowserSurfaceHandle,
  DappBrowserSurfaceProps,
} from '../../capabilities/dapp-interaction/browserTransport';
import { readVerifiedDappMessage } from '../../capabilities/dapp-interaction/verifiedDappMessage';

import { canMountDappWebView } from './browserAvailability';
import { prepareDappNetworkGuard } from './androidNetworkGuard';
import { buildFreighterInjectionScript, buildFreighterReply, readSep53ReplyId } from './freighterInjection';

const styles = StyleSheet.create({ root: { flex: 1 } });

/** Transport-only. URL policy, account/session validation and permission
 * decisions are deliberately owned outside this platform component. */
export const SecureDappWebView = forwardRef<DappBrowserSurfaceHandle, DappBrowserSurfaceProps>(
  function WebViewTransport({ url, shouldLoad, onMessage, onNavigation, onDocumentStart, onUnavailable }, ref) {
    const webview = useRef<React.ElementRef<typeof WebView>>(null);
    const injected = useMemo(() => buildFreighterInjectionScript(), []);
    const [ready, setReady] = useState(Platform.OS === 'ios');
    const unavailable = useRef(onUnavailable);
    unavailable.current = onUnavailable;

    useEffect(() => {
      if (Platform.OS !== 'android') return;
      let live = true;
      prepareDappNetworkGuard().then(
        () => {
          if (live) setReady(true);
        },
        () => {
          if (live) unavailable.current?.();
        },
      );
      return () => {
        live = false;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reply(response, target) {
          const reply = buildFreighterReply(response, target);
          if (!reply) return;
          if ('nativeCommand' in reply) webview.current?.postMessage(reply.nativeCommand);
          else webview.current?.injectJavaScript(reply.script);
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

    // No initial request, renderer or injected bridge exists until native ack.
    if (!canMountDappWebView() || !ready) return null;

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
            sep53ReplyId?: unknown;
          };
          const verified = readVerifiedDappMessage({
            data: nativeEvent.data,
            sourceOrigin: nativeEvent.sourceOrigin,
            isMainFrame: nativeEvent.isMainFrame,
          });
          if (!verified) return;
          onMessage(verified.data, verified.origin, readSep53ReplyId(nativeEvent.sep53ReplyId));
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
