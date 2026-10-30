# S16 Android embedded dApp browser request boundary

Status: candidate based on main `02667437af22422e0592b22ec2a8130f21bc26e4`.
Owner: features/dapps; platform/dapp-browser and Android network transport.
Classification: Adapt, clean-room; no Stellar/Xaman implementation copied.
Maturity: existing browser scaffold; this slice restores Android reachability with
native network-mechanism evidence. It does not promote the wallet to L4.

## Behavior

- Android may offer the existing in-app URL launch only if the installed native
  module and System WebView support proxy override and verified message listeners.
  Other Android installations retain the explicit system-browser fallback.
- Before a WebView is created, native code installs and acknowledges a process-wide
  WebView proxy with no DIRECT rule and with implicit localhost/link-local bypass
  removed. Pending, failed or timed-out preparation never mounts a WebView. Failure
  retires the feature session and clears pending connection/signature decisions.
- The proxy accepts CONNECT tunnels to syntactically public domain names only.
  Plain HTTP proxy requests, IP literal authorities, local/reserved names and invalid
  ports are rejected. Every returned DNS address must be public; mixed public/private
  DNS answers fail closed. The validated InetAddress is used to dial without resolving
  the hostname again. IPv4 private/shared/link-local/reserved/documentation/multicast
  addresses and IPv6 non-global/transition/documentation ranges are rejected.
- The tunnel carries opaque TLS bytes. WebView continues to validate the certificate
  and hostname normally. There is no TLS interception, installed CA, SSL-error bypass,
  plaintext response rewriting or wallet access in the production proxy.
- This network boundary applies to WebView HTTP(S) requests, including document POST,
  fetch/XHR and redirect connections. It is not a VPN or a claim of controlling every
  possible browser protocol (for example WebRTC UDP). Existing native navigation,
  origin validation, main-frame bridge filtering and document/session retirement
  remain separate controls.
- The override is retained for the app process, across browser unmounts and React
  context reloads. It is never cleared to DIRECT. A failed proxy leaves requests
  blocked; a new app process prepares a new proxy. Other native HTTP clients are not
  configured by this WebView-specific override. Future WebView surfaces must account
  for this process-wide policy.
- Proxy workers, headers, connect and idle times are bounded. It binds only to local
  loopback, logs no URL/body and stores no browser payload or wallet material.
- Native WebChromeClient PermissionRequest is denied until S21 per-origin device
  consent exists. Websites cannot inherit CAMERA/audio/protected-media grants from
  the native scanner or another app flow. Native scanner permission is unchanged.
- No permissions are granted by this restoration. Existing explicit access approval,
  account/network revision checks, persistent grant revocation, exact-XDR review and
  SDK/Core authorization/signing remain authoritative. No automatic transaction
  submission or catalog auto-connection is added. PR #133 remains separate.

## Compatibility limits

Local-network sites and public-looking hostnames resolving to private addresses are
not supported. The conservative address policy can reject special network setups.
Unavailable native/WebView capabilities use the existing external-browser fallback;
a startup failure requires leaving and reopening the browser. Open tunnels have a
90-second idle timeout. The current connector uses the first validated DNS address;
address-family fallback and a broader device/provider matrix are deferred.

## Native test setup and evidence boundaries

Run `npm run test:dapp-browser:android -- --rebuild` with Android SDK/Gradle dependencies
available. The default device is `emulator-5554`; override `FRESNICA_ANDROID_DEVICE` if
needed. The script installs debug and androidTest APKs without clearing wallet data.
It leaves `test-results/dapp-browser-native.log` and fails on instrumentation failure,
including when adb itself exits zero. Test-only Activity, CA and trust config exist
only in debug; the dummy private key exists only in the androidTest APK. Release
contains none of these fixtures. Production SSL errors are never ignored.

The fixture uses a real Android WebView, a local TLS receiver and separate IPv4/IPv6
forbidden receivers. Only the fixture resolver/dialer are replaced: public DNS answers
are mapped to the local TLS receiver so the tests do not need a deployed dApp. The
production address filter, CONNECT parser and byte forwarding are exercised. A final
case uses the unmodified production resolver/dialer against `https://example.com/`.
The WebViewClient deliberately installs no URL gate, proving the network proxy rather
than a late navigation callback. TLS verification is active in all cases.

The 17 cases cover address policy; raw proxy denial; normal GET/form POST; direct
HTTPS/HTTP/IPv6-loopback POST; private/mixed DNS POST; GET and 307 POST redirects to
loopback; public cross-origin redirect; certificate rejection; fetch POST; forbidden
fetch; proxy shutdown without DIRECT fallback; production DNS/dial/TLS; native device-permission denial without any grant path.

These are native network-mechanism tests. They are not acceptance of the RN browser
chrome, actual dApp Freighter SDK compatibility, wallet authorization, native signing
cancel/retry, hardware signers, or a physical Android device. Existing repository
session/signing tests remain relevant but cannot close those product acceptance gaps.
