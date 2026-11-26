import { MAX_BRIDGE_MESSAGE_LENGTH } from '../../capabilities/dapp-interaction/freighterSession';

import type { DappMessageReplyTarget } from '../../capabilities/dapp-interaction/browserTransport';
import type { BridgeResponse, DappNotificationResponse } from '../../capabilities/dapp-interaction/freighterSession';

const SEP53_PREFIX = 'fresnica-sep53:';
const validReplyId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function readSep53ReplyId(value: unknown): string | undefined {
  return typeof value === 'string' && validReplyId.test(value) ? value : undefined;
}

export function readSep53ReplyExpiresAt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER
    ? value
    : undefined;
}

export function buildFreighterReply(
  response: BridgeResponse | DappNotificationResponse,
  target?: DappMessageReplyTarget,
): { nativeCommand: string } | { script: string } | undefined {
  const payload = JSON.stringify(response);
  if (target) return { nativeCommand: SEP53_PREFIX + target.replyId + ':' + payload };
  if (
    'signedBlob' in response ||
    'publicKey' in response ||
    'userInfo' in response ||
    'network' in response ||
    'networkDetails' in response ||
    'isAllowed' in response ||
    'isConnected' in response
  )
    return undefined;
  return { script: 'window.postMessage(' + payload + ', window.location.origin);true;' };
}

// Forwards the page's own Freighter postMessage envelope. The native WebView
// origin check is the authenticator; this script does not add a secret.
export function buildFreighterInjectionScript(): string {
  return [
    '(function() {',
    '  if (window.top !== window.self || !window.location || window.location.protocol !== "https:") return true;',
    '  if (window.__fresnicaBridge === true) return true;',
    '  var nativeBridge = window.ReactNativeWebView;',
    '  if (!nativeBridge || typeof nativeBridge.postMessage !== "function") return true;',
    '  window.__fresnicaBridge = true;',
    '  var document = window.document;',
    '  var iosSep53 = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.FresnicaSep53;',
    '  var forwardReply = function(data) {',
    '    try {',
    '      if (window.document !== document) return;',
    '      var reply = JSON.parse(data);',
    '      if (reply && reply.source === "FREIGHTER_EXTERNAL_MSG_RESPONSE") window.postMessage(reply, window.location.origin);',
    '    } catch (_error) {}',
    '  };',
    '  if (!iosSep53 && typeof nativeBridge.addEventListener === "function") {',
    '    nativeBridge.addEventListener("message", function(event) { forwardReply(event.data); });',
    '  }',
    '  window.freighter = true;',
    '  var stellar = window.stellar && typeof window.stellar === "object" ? window.stellar : {};',
    '  stellar.provider = "freighter";',
    '  stellar.platform = "desktop";',
    '  stellar.wallet = "fresnica";',
    '  stellar.bridgeVersion = "1";',
    '  var clock = window.FresnicaNotificationClock;',
    '  if (clock && typeof clock.now === "function") stellar.notificationNow = function() { return clock.now(); };',
    '  window.stellar = stellar;',
    '  window.addEventListener("message", function(event) {',
    '    try {',
    '      if (event.source !== window || event.origin !== window.location.origin) return;',
    '      var payload = event.data;',
    '      if (!payload || (payload.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST" && payload.source !== "FRESNICA_DAPP_MSG_REQUEST")) return;',
    '      var serialized = JSON.stringify(payload);',
    '      if (!serialized || serialized.length > ' + String(MAX_BRIDGE_MESSAGE_LENGTH) + ') return;',
    '      if (payload.source === "FREIGHTER_EXTERNAL_MSG_REQUEST" && payload.type !== "SUBMIT_TRANSACTION") {',
    '        var requestId = payload.messageId;',
    '        if (iosSep53) iosSep53.postMessage(serialized).then(forwardReply, function() {',
    '          forwardReply(JSON.stringify({ source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: requestId,',
    '            error: "request-unavailable", apiError: { code: -1, apiCode: -1, message: "Wallet request unavailable" } }));',
    '        });',
    '        else if (typeof nativeBridge.addEventListener === "function") nativeBridge.postMessage(' +
      JSON.stringify(SEP53_PREFIX) +
      ' + serialized);',
    '      } else nativeBridge.postMessage(serialized);',
    '    } catch (_error) {}',
    '  });',
    '  return true;',
    '})();',
    'true;',
  ].join('\n');
}
