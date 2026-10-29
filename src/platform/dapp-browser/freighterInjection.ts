import { MAX_BRIDGE_MESSAGE_LENGTH } from '../../capabilities/dapp-interaction/freighterSession';

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
    '      nativeBridge.postMessage(serialized);',
    '    } catch (_error) {}',
    '  });',
    '  return true;',
    '})();',
    'true;',
  ].join('\n');
}
