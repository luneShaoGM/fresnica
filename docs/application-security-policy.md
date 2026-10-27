# Fresnica Mobile Application Security Policy

This document records the Mobile product policy layered on top of the Fresnica Native SDK security boundary.

## Passphrase, not PIN/passcode UX

Fresnica Mobile uses a strong **app passphrase** to protect local software signing material. Product UI must not present this credential as a short numeric PIN/passcode.

New passphrases must contain at least 15 Unicode characters. This follows the current upstream passphrase policy and intentionally rejects PIN-length values such as `123456`.

Product intent is passphrase-first protection with system-auth convenience: creating or importing a protected software signer establishes the strong app passphrase, routine signing should normally use System Auth, and serious maintenance or explicitly high-risk actions require a fresh passphrase. The product must not offer a short numeric passcode mode as an alternative protection root.

Firefly and imToken are UX references for this split between a strong wallet credential and convenient system authentication; they are not implementation or cryptographic authorities. Compared with Xaman strongest-password mode, Fresnica intentionally relies more on System Auth for routine actions while retaining fresh-passphrase authority for export, recovery, credential rotation, and other serious maintenance.

The Native Binding API 3 still exposes compatibility names such as `appPasscode`, `signWithPasscode`, and `invalid-passcode`. Mobile may keep those names at the platform adapter boundary until the upstream binding contract changes; product/domain/UI terminology is `passphrase`.

Never persist the passphrase, mnemonic, secret key, WalletUnlockKey, decrypted signer material, or biometric cipher/authentication state in Realm, Redux/navigation state, logs, analytics, or crash reports.

## Authentication hierarchy

```text
fresh strong app passphrase
        >
System Auth (Face ID / Touch ID / fingerprint / device auth)
```

System Auth is the normal convenience path for routine signing. It is not a recovery root and must not replace the strong passphrase for security-sensitive maintenance.

## Product behavior

Routine transaction signing should prefer `signWithSystemAuth` when the signer is registered in the System Auth Domain. This keeps normal use biometric-first and avoids repeatedly asking for a long credential.

A fresh app passphrase is required for at least:

- Reveal / Export of mnemonic or `S...` secret material;
- changing or rotating the app passphrase;
- security-domain reset/recovery operations where knowledge of the protection credential is the authority;
- transactions or actions explicitly classified by product policy as high risk.

Signing Coordination represents this with an explicit `routine | passphrase-required` authorization policy. A `passphrase-required` action must not probe or invoke System Auth before asking for the fresh passphrase.

The exact high-risk transaction classification belongs in Application Security / Signing Coordination policy, not in individual feature screens. Send, Swap, trustline, dApp, and future transaction flows must not each invent their own biometric/passphrase branching.

## System Auth settings

Mobile owns the product orchestration around the Native SDK System Auth Protection Domain:

1. inspect device availability and current domain state;
2. initialize the device-level domain once through `initializeSystemAuth(reason)`;
3. use the current app passphrase to register each protected software signer through `registerSignerSystemAuth`;
4. report partial signer-registration failures explicitly so they can be retried;
5. remove the domain through `removeSystemAuthDomain` when the user disables System Auth.

A newly initialized domain is removed again if every signer registration fails. An existing domain or a partially successful registration set remains available for explicit repair/retry.

The app passphrase is held only in the Security Settings component long enough to perform registration and is never persisted.

## One app passphrase over protected software signers

Fresnica presents one product app passphrase over the local protected software-signer set. Mobile must not silently provision additional protected signers under unrelated passphrases.

Current SDK/Capability code includes `verifyProtectedSignerPassphrase`, returning only success/failure for an existing protected signer. `verifyExistingAppPassphrase` verifies the protected local signer set through that port. The historical claim that this verification-only API is missing is superseded; existing-wallet Create/Import/HD must be assessed against current code rather than treated as watch-only-only.

Verification must keep derivation and envelope verification below the framework boundary, return no secret/unlock key, and fail on missing/corrupt envelopes. A verifier that reports zero protected signers is not proof of authentication for a sensitive setting. Do not substitute reveal, dummy signing, reprotect or a JavaScript KDF/verifier.

Shared sensitive-setting policy and network transitions are specified in `behavior-specs/shared-auth-network-session.md`. This design does not imply that generic biometric app unlock has been implemented.

## App session lock boundary

Application lock/session state belongs to Mobile, but unlocking it safely requires platform authorization mechanisms that do not misuse signing or recovery-material APIs.

The current React Native adapter has no generic System Auth challenge against an existing Protection Domain. `initializeSystemAuth` authenticates only while creating a domain, and `signWithSystemAuth` authenticates only while authorizing an actual signing operation.

A safe app-session biometric unlock therefore remains blocked on an upstream platform operation, conceptually:

```text
authenticateSystemAuth(reason) -> success / cancelled / unavailable / invalidated
```

It should authenticate an existing System Auth Protection Domain using a native challenge, without signing a transaction and without returning a WalletUnlockKey or recovery material.

Until that operation exists, Fresnica Mobile must not implement session unlock using Reveal, a dummy XDR, a fake biometric probe, or a parallel JavaScript credential scheme.

## Xaman comparison

This policy intentionally differs from a wallet configured to demand its strongest password on routine actions. Fresnica Mobile optimizes the common path around System Auth while retaining strong passphrase authority for serious maintenance and high-risk actions. This is a product-policy comparison only; Xaman is not the implementation authority for Fresnica security semantics.

## Native SDK boundary

The Native SDK/Core remains the security authority for protected envelopes, cryptography, signer identity verification, transaction signing, and native authorization primitives. Mobile controls when a user must provide System Auth versus a fresh passphrase; it does not reimplement the cryptography.
