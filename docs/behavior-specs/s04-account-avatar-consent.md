# S04 account avatar informed opt-in

Phase 0 and existing Settings/Contacts foundations reused. S04 privacy / S13 address avatars, Adapt display-only product role, clean-room implementation. No donor source. Strict presentation scope extends PrivacySettingsScreen. Account avatars remain independent of Token image permission and do not grant signing or identity authority.

New installations, previous OFF choices, and legacy enabled preferences without
disclosure version 2 are OFF. The existing Settings > Privacy control asks
for consent before enabling the unified rule. It discloses the provider,
complete displayed public addresses for all accounts, IP/time correlation,
device cache retention, and opt-out. No private keys or App Passphrase are
transmitted. Cancel/back makes no write or request. Acceptance atomically
persists the enabled choice and version 2 in the existing preferences JSON.
The deprecated per-account selections are ignored. No Realm schema change.
A previously acknowledged user can toggle again without repeated disclosure.

Turning off commits the disabled choice and advances the disk cache epoch
before requesting deletion. Previously cached files cannot be reused after
re-enabling even if the process exits before clearing finishes. Native storage
is separate from Token icons and is excluded from device backups. A failed
preference write retains the prior effective choice. See the
[S13 avatar contract](s13-avatar-alignment.md) for limits and identity.

Tests cover defaults/legacy normalization, missing/invalid consent marker, confirmation/cancel, persistence failure, reopen, independent Token setting and runtime wiring. Native interaction/accessibility/network observation not implied. No maturity or release promotion.

Implementation validation: complete current-tree Jest 264 suites / 2450 tests PASS; focused privacy/network suites 4 / 48 PASS; real Realm preferences close/reopen/rollback integration 1 suite / 4 tests PASS; TypeScript, targeted lint, architecture, aliases, provenance and locales PASS. Native interaction and independent Work review remain pending.
