# Owner-authorized artwork reuse — 2026-11-09

The project owner explicitly confirmed that the **default Token image named
image_unknown_trustline_light, App Icon, logo, and XLM Icon** in their Stellar
reference project were self-designed and may be reused in Fresnica Mobile.
This permission is limited to those named image families; other images must
still be approved first. It is a user assertion of rights, not an independent
copyright audit or permission to port source code, fonts, other graphics or
third-party brand identities.

Reference: origin/Stellar (fixed Stage-0 provenance baseline
bd0f4540b2496a57314e4e29bc6fcf8ff691b60f). Paths below are relative
to that reference tree.

| Purpose | Reference path | Source SHA-256 |
| --- | --- | --- |
| Default Token light | ios/Xaman/Images.xcassets/Graphics/ImageUnknownTrustLineLight.imageset/image_unknown_trustline_light@3x.png | cc8007609e2e6be91f85a144f2c0b01756faffdabd9223280d19f33f29486141 |
| XLM square icon | ios/Xaman/Images.xcassets/Icons/IconXlmSquare.imageset/icon_xlm_square@3x.png | 8fd2d869e105f44c5fa3d5b353efbcda1386307aa892ca77a07ad4dd917074e5 |
| App Icon master | docs/stellar-migration/assets/firefly/firefly-icon-dark-full-1024.png | 842c6bf520b7989616ceb99a9ceebe6a5b2a4d6bbeebc1af4698b976a2f6e2a7 |
| Legacy round icon master | docs/stellar-migration/assets/firefly/preview-circular-appicon.png | 5088c345dc805600d8ab96082a60d426739ed87064b67a87353ffc0a82208828 |
| Adaptive foreground and rocket mark | docs/stellar-migration/assets/firefly/firefly-adaptive-fg-1024.png | 8afcc8034b7186f7cf5fe09a484de8b683d78cb1f09659929bd140e73329c134 |

## Derivative destinations and resolution policy

- Default Token: src/ui/components/TokenFallbackAvatar/assets/unknownTokenLight.png,
  unknownTokenLight@2x.png and unknownTokenLight@3x.png (40/80/120 px).
  The former theme-dependent dark variant is no longer used or bundled.
  No generated icon, colored backing, code initials or address identity
  appears when a credit Token image is absent.
- Native XLM: src/ui/assets/token/xlmSquare.png, @2x, @3x (40/80/120 px).
  Always local and independent of optional remote asset media consent.
- In-app Fresnica rocket: src/ui/assets/brand/fresnicaMark.png, @2x,
  @3x (36/72/108 px). The transparent reference foreground is center
  cropped to 640 px and then downsampled; the accompanying wordmark in
  the app remains **Fresnica**. Stale FIREFLY lettering from the reference
  is deliberately excluded.
- iOS: ios/Fresnica/Images.xcassets/AppIcon.appiconset contains 8 iPhone
  slots, 9 iPad slots and one opaque RGB 1024x1024 App Store icon.
- Android: five mipmap densities provide square, circular and adaptive
  foreground PNGs at 48/72/96/144/192 px and 108/162/216/324/432 px,
  respectively; mipmap-anydpi-v26 adaptive XML references the local
  foreground and navy launcher background.

All source artwork was resized and/or re-encoded with the built-in macOS
sips image tool into platform-specific PNGs; no donor code was reused.
The target marketing PNG is opaque RGB, as required by the Apple catalog.
Different PNG bytes and a passing fixed-snapshot donor collision gate are
**not proof of copyright ownership**; the owner permission above is the
rights basis.

The new artwork:check npm script checks React Native 1x/2x/3x files,
all 18 iOS icon slots and Android densities/adaptive resources.
The regular provenance:check remains enabled and no blanket exception
or weakened source gate was introduced.

**Not yet native acceptance:** device launcher appearance (iPhone, iPad,
Android legacy/round/adaptive), rendering under device theme/scale/font,
and Home/Activity/AssetDetails appearance require native product-flow QA.
Resizing bitmaps cannot recover details lost in the source artwork.

## 2026-11-10 Home XLM monetary symbol

The same previously approved **XLM Icon** family also covers the monochrome
symbol at `ios/Xaman/Images.xcassets/Icons/IconXlm.imageset/icon_xlm@3x.png`
(SHA-256 `85954448cace109e2c37ac45448dbf6b206c599f271b3542560297fec5012c59`).
It is independently resized/re-encoded with macOS sips to 12/24/36 px at
`src/ui/assets/token/xlmSymbol{,@2x,@3x}.png`. It is tinted through AppTheme
for the Home amount and reserve prefixes; the left avatar keeps xlmSquare.
No donor component, font or other artwork is reused. Native theme/scale QA
remains unexecuted by the resource and repository checks.
