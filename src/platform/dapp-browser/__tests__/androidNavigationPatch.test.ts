import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Install-time native patch contract. This is not an emulator/device POST flow.
const clientPath = resolve(
  process.cwd(),
  'node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java',
);

describe('Android dApp native navigation patch contract', () => {
  const source = readFileSync(clientPath, 'utf8');

  it('stops and hides unsafe main-frame POST loads before injecting the wallet bridge', () => {
    const start = source.indexOf('public void onPageStarted(');
    const end = source.indexOf('private static boolean isPublicNavigation(', start);
    const handler = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(handler).toContain('if (!isPublicNavigation(url)) {');
    expect(handler).toContain('webView.stopLoading();');
    expect(handler).toContain('webView.setVisibility(View.INVISIBLE);');
    expect(handler).toContain('blocked.putBoolean("navigationBlocked", true);');
    expect(handler).toContain('return;');
    expect(handler.indexOf('webView.stopLoading();')).toBeLessThan(
      handler.indexOf('reactWebView.callInjectedJavaScriptBeforeContentLoaded();'),
    );
  });

  it('intercepts unsafe main-frame resource requests without changing subframe policy', () => {
    expect(source).toContain('if (request.isForMainFrame() && !isPublicNavigation(request.getUrl().toString())) {');
    expect(source).toContain('new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]))');
    expect(source).toContain('return super.shouldInterceptRequest(view, request);');
  });
});
