import { MAX_BRIDGE_MESSAGE_LENGTH } from '../../capabilities/dapp-interaction/freighterSession';

import type { DappMessageReplyTarget } from '../../capabilities/dapp-interaction/browserTransport';
import type { BridgeResponse } from '../../capabilities/dapp-interaction/freighterSession';

const DOCUMENT_MARKER = '__fresnicaSep53Document';
const validDocumentId = /^[0-9a-f]{32}$/;

export function unwrapFreighterMessage(data: string): { data: string; documentId?: string } | undefined {
  try {
    const message = JSON.parse(data);
    if (message?.type === 'SUBMIT_BLOB') return undefined;
    if (message?.fresnicaDocument === undefined) return { data };
    if (
      typeof message.fresnicaDocument !== 'string' ||
      !validDocumentId.test(message.fresnicaDocument) ||
      typeof message.payload !== 'string' ||
      JSON.parse(message.payload)?.type !== 'SUBMIT_BLOB'
    )
      return undefined;
    return { data: message.payload, documentId: message.fresnicaDocument };
  } catch {
    return undefined;
  }
}

export function buildFreighterReplyScript(response: BridgeResponse, target?: DappMessageReplyTarget): string {
  const payload = JSON.stringify(response);
  if (!target) return 'window.postMessage(' + payload + ', window.location.origin);true;';
  const origin = JSON.stringify(target.origin);
  return (
    'if(window.location.origin===' +
    origin +
    ' && document[' +
    JSON.stringify(DOCUMENT_MARKER) +
    ']===' +
    JSON.stringify(target.documentId) +
    '){window.postMessage(' +
    payload +
    ', ' +
    origin +
    ');}true;'
  );
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
    '  var documentId;',
    '  try {',
    '    var random = window.crypto.getRandomValues(new Uint8Array(16));',
    '    documentId = "";',
    '    for (var i = 0; i < random.length; i++) documentId += ("0" + random[i].toString(16)).slice(-2);',
    '    Object.defineProperty(document, ' + JSON.stringify(DOCUMENT_MARKER) + ', { value: documentId });',
    '  } catch (_error) { documentId = undefined; }',
    '  window.freighter = true;',
    '  var stellar = window.stellar && typeof window.stellar === "object" ? window.stellar : {};',
    '  stellar.provider = "freighter";',
    '  stellar.platform = "desktop";',
    '  stellar.wallet = "fresnica";',
    '  stellar.bridgeVersion = "1";',
    '  window.stellar = stellar;',
    '  window.addEventListener("message", function(event) {',
    '    try {',
    '      if (event.source !== window || event.origin !== window.location.origin) return;',
    '      var payload = event.data;',
    '      if (!payload || payload.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;',
    '      var serialized = JSON.stringify(payload);',
    '      if (!serialized || serialized.length > ' + String(MAX_BRIDGE_MESSAGE_LENGTH) + ') return;',
    '      if (payload.type === "SUBMIT_BLOB") {',
    '        if (!documentId) return;',
    '        nativeBridge.postMessage(JSON.stringify({ fresnicaDocument: documentId, payload: serialized }));',
    '      } else nativeBridge.postMessage(serialized);',
    '    } catch (_error) {}',
    '  });',
    '  return true;',
    '})();',
    'true;',
  ].join('\n');
}
