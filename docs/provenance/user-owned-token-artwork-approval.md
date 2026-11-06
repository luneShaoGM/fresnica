# Explicit authorization: default Token artwork (2026-11-06)

Project owner directly confirmed in the Fresnica Mobile development chat on
2026-11-06: **the default Token images in the Stellar project are our own,
and may be copied for this Fresnica change**. This is a user-supplied
ownership and use authorization, not an independent legal determination.

**Scope is limited to the two asset-image variants below.** The user also
instructed that any *other* image duplication from Stellar must be
individually approved first; this record is not blanket permission.

Source tree: origin/Stellar@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f.

| Visual | Source path under ios/Xaman/Images.xcassets/Graphics/ | Source SHA-256 | Destination | Destination SHA-256 |
| --- | --- | --- | --- | --- |
| Default Token | ImageUnknownTrustLine.imageset/image_unknown_trustline@3x.png | 8e63093830c7b4a53adc87081c213b01ac915fd9e60de22534abd67d3abe1a7f | src/ui/components/TokenFallbackAvatar/assets/unknownToken.png | 1cb3b70bf3ffe8b8902f34ead3a3fa1a0216bcd5767cf823d34f0d253f36229c |
| Light Token | ImageUnknownTrustLineLight.imageset/image_unknown_trustline_light@3x.png | cc8007609e2e6be91f85a144f2c0b01756faffdabd9223280d19f33f29486141 | src/ui/components/TokenFallbackAvatar/assets/unknownTokenLight.png | f9a91fe7d64f71de1a1f88310398aa2b229333c98d29928e6c006a0dd3963db1 |

Both output PNGs were resized locally to at most 128 px, preserving image
content but changing bytes; npm run provenance:check remains enabled and
must pass without new general-purpose allowlist exceptions. **A distinct
Git blob does not itself prove original creation or copyright ownership.**
The exact visual reuse is based on the owner's direct instruction above.

No donor application code, UI implementation structure, other images, or
font resources are approved by this record. Public Token metadata/image
origin checks, network isolation, and existing auth/security behavior
remain unchanged.
