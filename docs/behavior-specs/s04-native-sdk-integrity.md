# S04 local Native SDK integrity

Phase 0 and 2a/2b foundations retained. S04 release/security engineering; Adapt pinned-artifact verification, clean-room Fresnica implementation (no donor source). SDK/Core cryptography and adapter authority unchanged.

Local Android preBuild and the always-run Xcode app build phase verify actual staged Native SDK files against config/native-sdk-integrity.json. CI consumes the same verifier after staging. Missing, modified, substituted or additional framework files stop the build. The Apple per-file/symlink inventory was derived only after verifying the official 0.3.1 ZIP against committed SHA-256 97545f6b5a3ab8b4fe05f0c8b7e012b4c76e9858500c373eea43fd21daa8d5be. Android retains the prior committed AAR pin. Adapter revision/manifest checks remain separate.

Validation: Node fixture test rejects mutation, missing/extra files and symlink substitution; real staged Android AAR and Apple framework inventory pass; Xcode project syntax passes. Native build/link and device acceptance are not implied. Independent exact-HEAD Work review required; no maturity promotion.
