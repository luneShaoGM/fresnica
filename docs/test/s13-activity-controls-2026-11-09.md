# S13 Activity controls — evidence boundaries (2026-11-09)

Base: main118460b8556641d2e1e28a0561bd71e7fd22ec67. Development candidate;
not a dual-platform acceptance signoff. Current authoritative behavior is
[Activity controls completion](../behavior-specs/s13-activity-controls-completion.md).
No account, signer, authorization, XDR, ledger write, native code or cache schema
was changed. Existing S06 native media safety gates remain independently owned.

## Executed developer verification

- Full automated repository tests: 255 suites / 2,373 tests passed. An earlier run
  found an obsolete test targeting the old header refresh action; it now exercises
  the actual native RefreshControl and cleans up the new calendar timer. No
  failing result is counted as success.
- Direct coverage: draft Apply/Cancel/back, default compact entry, exact manually
  hidden issuer/reveal/restore, failed inclusion, read/pagination recovery and
  superseded refresh, same-leg direction/asset/amount matching, 0.1XLM exact
  destination boundary and exclusions, shared media consent and pair avatars.
- Calendar tests also executed with America/New_York timezone: local DST,
  month/year boundaries, future dates, localized Today/Yesterday. Foreground
  midnight update and timer cleanup are deterministic hook tests.
- Type/lint (zero errors; inherited warnings), architecture, alias, format,
  provenance and locale checks. No new dependency or provenance exception.
- Android and iOS production JS bundles: developer build evidence only; no
  native compilation, installation or product interaction acceptance implied.

## Actual device/runtime boundary

Android emulator-5554 and iPhone15Pro/iOS17.2 simulator
DEF9E99C-0D02-4803-B457-CFB631433DFD were detected booted. UI-control connection
to the iOS Simulator timed out twice (first approximately100s, bounded retry15s),
so this run obtained no product screenshots or native click evidence. The existing
8081 development server/user test wallet was not replaced or cleared.

| Native scenario | Android | iOS |
| --- | --- | --- |
| Compact header/filter sheet and long issuer layout | NOT RUN | BLOCKED UI bridge |
| Large fonts, narrow screen, dark/theme contrast | NOT RUN | BLOCKED UI bridge |
| TalkBack/VoiceOver actual focus and announcements | NOT RUN | BLOCKED UI bridge |
| Real cached offline Activity -> Retry -> revalidate -> cold restart | NOT RUN | BLOCKED UI bridge |
| Foreground/background and real account/network switching | NOT RUN | BLOCKED UI bridge |
| Live-ledger effects quantity + shared safe-logo network behavior | NOT RUN | NOT RUN |

Repository mocks, injected lifecycle tests, bundle success and CI must not be
relabelled as any row above. Native acceptance remains open; S13 stays L3 partial.
Stage9 real-iPhone System Auth cancel/retry remains DEFERRED as previously agreed.
No automatic spam/scam classification or current Claimable risk authority was
added to historical Activity. Missing current risk data stays unclassified.

## Independent-review corrections

Initial head43c6d8 had two P2 findings: i128 contract events were incorrectly
restricted to classic i64, and included failed records did not match their known
operation-type categories. Both corrected within the same PR. Added contract
maximum/overflow/classic-domain cases and known failed-family/category plus
screen inclusion cases. Final full repository run:255suites/2,376tests passed;
type/lint zero errors (50 inherited warnings), architecture/provenance/diff pass.
A fresh exact-HEAD independent review and CI are required for the correction.
