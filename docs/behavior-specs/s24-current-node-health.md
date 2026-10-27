# S24 current-node health and retry

## Scope and authority

Maturity Phase 0 is passed; the runtime/injection and shell/theme carriers in architecture rows 2a/2b/2c exist. S24 remains L1 until native product evidence is recorded. This clean-room Adapt slice exposes the existing current-network read-session health in Settings. Feature owner: settings; semantics/types: Network capability; runtime wiring: app. Strict scope: NetworkSettingsScreen and NetworkNodeHealth. No donor source/resources are migrated.

Behavior reference inspected: Stellar Settings/Advanced/Network/NetworkSettingView, Add/AddNetworkView, Modules/NodeList/NodeListItem. Relevant roles are a current/default endpoint, health distinct from selection, node testing/retry and distinct wrong-network/error states. Add, default selection and removal confirmation/last-node protection belong to the next gated node-management slice, not this read-only health slice.

## Product behavior

- Settings > Network keeps the configured network and back action, and renders the actual current read-session endpoint rather than inventing a connection from the selected-network marker.
- The current-node section subscribes to the same session that gates Balance, Activity and transaction reconciliation. It starts with that session's snapshot; opening the page does not create another poller or health request.
- Render checking, connected, retrying, wrong-network, paused and closed distinctly. Connected means the shared public-read session is healthy; it does not certify signer/transaction gateway health or release readiness.
- Timeout, rate limit, unavailable and malformed response have safe localized messages. Never render raw transport exceptions, payloads or credentials.
- Retry is available in cooldown/wrong-network and invokes the existing session retry policy. It does not bypass Retry-After/backoff or force an immediate probe. Explain automatic retry and server cooldown. Checking/paused/closed/healthy have no actionable Retry.
- Offline/background pauses must not appear as wrong-network. Foreground/reconnect resumes the existing runtime path. Leaving the screen unsubscribes without closing the shared session. No timer is owned by the page.
- State is not only a colored dot: expose localized text, polite live-region announcements, selectable wrapping endpoint and native button labels.
- No node add/delete/selection, network identity, gateway, authentication, Realm schema, Account/Signer or exact-XDR behavior changes.

## Acceptance and boundaries

Automated: cover every phase and safe failure projection; Retry forwarding; session publish/unsubscribe; wrong-network recovery; offline/foreground; Retry-After and cancellation (existing runtime tests). Run typecheck, architecture, localization, lint/provenance gates and affected tests. Native visual, dynamic-font and VoiceOver/TalkBack acceptance are separate and remain unexecuted unless explicitly recorded. Stage 9 iOS System Auth cancel/retry remains deferred.

## Follow-up dependency

Authenticated Developer Mode is specified in product architecture §7.6 and execution plan §8B/§9. The detailed authentication state machine is not yet implemented. Reuse Native SDK verification-only App Passphrase support where applicable; generic existing-domain System Auth challenge remains upstream-blocked. Define fail-closed behavior with no protected signer, cancel/failure/retry, preference persistence, and Mainnet restoration before mode disable. Only then open custom endpoint add/test/select/delete, bind all read/quote/preflight/submit gateways consistently, invalidate old work, and preserve network/account/exact-XDR/recovery identity. Do not emulate challenge by reveal, dummy signing, reprotect or a JS credential verifier.

## Executed validation (2026-10-27)

- `npm run check`: PASS; typecheck, product smoke script static checks, formatter, lint (31 existing warnings / zero errors), alias/architecture, provenance and locale gates passed; 155 Jest suites / 1260 tests passed. This does not execute the native smoke product flow.
- Targeted health/settings/runtime run: 3 suites / 27 tests passed.
- No simulator/emulator, real-device, dynamic-font, VoiceOver/TalkBack or native product-flow acceptance executed for this slice. Independent Work exact-HEAD review remains pending.
