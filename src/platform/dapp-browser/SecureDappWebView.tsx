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
import {
  buildFreighterInjectionScript,
  buildFreighterReply,
  readSep53ReplyId,
  readSep53ReplyExpiresAt,
} from './freighterInjection';

const styles = StyleSheet.create({ root: { flex: 1 } });

// The legacy channel still carries transaction and notification requests.
// Ordinary Freighter requests require a native callback to their own document.
function isUnboundRequest(raw: string): boolean {
  try {
    const request: unknown = JSON.parse(raw);
    return (
      request !== null &&
      typeof request === 'object' &&
      'source' in request &&
      'type' in request &&
      ((request.source === 'FREIGHTER_EXTERNAL_MSG_REQUEST' && request.type === 'SUBMIT_TRANSACTION') ||
        (request.source === 'FRESNICA_DAPP_MSG_REQUEST' && request.type === 'SHOW_SYSTEM_NOTIFICATION'))
    );
  } catch {
    return false;
  }
}

/** Transport-only. URL policy, account/session validation and permission
 * decisions are deliberately owned outside this platform component. */
export const SecureDappWebView = forwardRef<DappBrowserSurfaceHandle, DappBrowserSurfaceProps>(
  function WebViewTransport(
    { url, shouldLoad, onMessage, onReplyExpired, onNavigation, onDocumentStart, onUnavailable },
    ref,
  ) {
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
        onNavigationStateChange={event => {
          const nativeEvent = event as typeof event & { sameDocumentHistory?: unknown };
          onNavigation({
            url: event.url,
            ...(typeof event.title === 'string' ? { title: event.title } : {}),
            canGoBack: event.canGoBack,
            canGoForward: event.canGoForward,
            ...(Platform.OS === 'android' && nativeEvent.sameDocumentHistory === true
              ? { sameDocumentHistory: true as const }
              : {}),
          });
        }}
        allowsBackForwardNavigationGestures
        onMessage={event => {
          const nativeEvent = event.nativeEvent as typeof event.nativeEvent & {
            sourceOrigin?: unknown;
            isMainFrame?: unknown;
            sep53ReplyId?: unknown;
            sep53ReplyExpiresAt?: unknown;
            sep53ReplyExpired?: unknown;
            firstCommittedDocumentUrl?: unknown;
          };
          const verified = readVerifiedDappMessage({
            data: nativeEvent.data,
            sourceOrigin: nativeEvent.sourceOrigin,
            isMainFrame: nativeEvent.isMainFrame,
          });
          if (!verified) return;
          const replyId = readSep53ReplyId(nativeEvent.sep53ReplyId);
          if (nativeEvent.sep53ReplyExpired === true) {
            // This native lifecycle event is not page data and carries no wall-clock deadline.
            if (Platform.OS === 'ios' && replyId) onReplyExpired?.(replyId, verified.origin);
            return;
          }
          const expiresAt = readSep53ReplyExpiresAt(nativeEvent.sep53ReplyExpiresAt);
          // iOS must bind review lifetime to the native callback, never a page field.
          const usableReplyId = Platform.OS === 'ios' && expiresAt === undefined ? undefined : replyId;
          if (!usableReplyId && !isUnboundRequest(verified.data)) return;
          const firstDocument =
            typeof nativeEvent.firstCommittedDocumentUrl === 'string' && nativeEvent.firstCommittedDocumentUrl
              ? nativeEvent.firstCommittedDocumentUrl
              : undefined;
          if (firstDocument) onMessage(verified.data, verified.origin, usableReplyId, expiresAt, firstDocument);
          else onMessage(verified.data, verified.origin, usableReplyId, expiresAt);
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
