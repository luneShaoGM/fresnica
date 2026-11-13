# Android release identity and local signing

Stage 9 release-engineering slice. Per the owner's 2026-11-13 decision,
the Android Application ID is `com.fresnica.wallet.test` for both Debug
and Release. The Java/Kotlin namespace and instrumentation class names remain
`com.fresnica.wallet`, and iOS remains `com.fresnica.mobile`. The Android
smoke scripts target the new install ID. Manifest provider authorities use
`${applicationId}` or library placeholders. The
`web+stellar` SEP-7 scheme remains unchanged.

This is a different Android installation from the earlier
`com.fresnica.wallet` and `com.fresnica.mobile` packages. No account,
signer, permission or Realm data migrates automatically. Preserve prior
installations and verified recovery materials; never uninstall, reset or
overwrite an existing wallet as part of this identity change.

The former `betaRelease` variant was removed because the standard
`release` build now already uses the requested test package ID.
Debug and Release cannot coexist under this same ID; Android also blocks
updates signed with a different certificate. Distribute the release-signed
artifact, and never remove existing wallet data merely to resolve a signing
mismatch.

## Signing

The owner explicitly authorized reusing the Stellar production signing material
on 2026-11-11. Only the keystore was copied to a private directory outside the
repository; passwords remain in macOS Keychain. No donor application source was
copied. The private local launcher reads credentials into the Gradle environment
and uses the existing four `FRESNICA_ANDROID_RELEASE_*` inputs. Partial/missing
configuration and debug-signing fallback retain the existing fail-closed policy.

On the configured Mac, run:

```sh
python3 /Users/lune/.config/fresnica/android/build-release.py
```

This builds `:app:assembleRelease` and `:app:bundleRelease`. The private launcher
and keystore are machine-local, are not shipped with the application, and are
not a CI configuration. Other machines/CI must provision the four existing
release signing inputs securely. Sharing the certificate with Stellar means
both applications depend on the same signing-key lifecycle.

Outputs are `android/app/build/outputs/apk/release/app-release.apk` and
`android/app/build/outputs/bundle/release/app-release.aab`. Verify the actual
certificate, package identity and packaged ABIs before distribution. A signed
artifact does not close native product acceptance, Testnet soak, store setup,
legal content, independent Work review or the remaining Stage 9 release gates.
