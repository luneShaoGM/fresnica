# Android release identity and local signing

Stage 9 release-engineering slice. Android namespace and Application ID are
`com.fresnica.wallet`; iOS remains `com.fresnica.mobile`. Native source packages,
instrumentation runner and Android smoke launchers use the Android identity.
Manifest provider authorities use `${applicationId}` or library manifest placeholders.
The existing `web+stellar` SEP-7 scheme remains the protocol scheme.

This identity is a separate Android installation from `com.fresnica.mobile`.
There is no automatic transfer of accounts, signers or Realm data. Preserve the
old installation and verified recovery materials; do not clear or uninstall it
as part of installing the new package.

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
