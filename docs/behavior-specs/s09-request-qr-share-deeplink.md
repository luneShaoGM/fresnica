# S09 Request / QR / share / deep-link behavior specification

Status: frozen for the Stage 5 S09 construction sequence starting from `main@2a4476e0e8d842c412ca94a1874c42490a5e09a5`.

Trace ID: `S09` — Request / QR / scan / share / paste / deep link.

Related IDs: `S08` owns muxed/M-address semantics and remains blocked on a shared destination contract; `S27` owns camera/share/clipboard/deep-link platform roles.

Provenance: clean-room behavior rewrite. `origin/Stellar@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f` is a product-role reference only. Donor source, helpers, component structure, tests and resources are not implementation templates. Stellar SEP-7 is the protocol authority for `web+stellar:` request syntax.

## Scope

Stage 5 S09 closes the public receive/request loop:

- build a public payment request for one local Classic account;
- optionally include exact amount, exact asset identity, supported memo and a short request message;
- render the same canonical request as copyable text, system share payload and QR content;
- parse pasted, scanned and OS deep-link input through one typed parser;
- route an accepted inbound payment request into the existing Send product flow for explicit review and authorization.

This slice does not add transaction signing from a URI, callbacks, verified remote origin, muxed destinations, path-payment conversion, dApp browser behavior, secret import, optimistic ledger state or a second submission pipeline.

## Authority and layering

The request URI is public product data, not transaction authority. An inbound URI may prefill Send form intent only. The existing Payment capability must still prepare the exact transaction, exact-XDR review remains the authorization boundary, and the existing Signing/Transaction/Stage 2.5 recovery pipeline remains unchanged.

Ownership is split as follows:

- a Request domain module owns canonical request DTOs plus SEP-7 pay build/parse rules;
- Feature code owns form state, localized presentation and explicit user actions;
- App navigation owns account/network routing and cold/warm deep-link composition;
- Platform ports own QR rendering, system share, clipboard access, camera scan and OS deep-link ingress;
- Payment remains authoritative for whether the eventual outbound payment is executable.

Feature/domain code must not import React Native camera, Share, Clipboard or Linking APIs directly.

## Account eligibility

Request is available for a visible Classic `G...` account on the active network, including watch-only accounts, because creating or sharing a receive request does not require signing.

An inactive Classic account may request native XLM so a payer can activate it through the existing Payment/CreateAccount semantics.

Contract accounts and any identity kind outside the current Classic account contract fail closed.

Request must not synthesize or expose a muxed `M...` receiving identity. Muxed identity support remains S08 work.

## Canonical outbound SEP-7 pay request

The canonical outbound URI uses `web+stellar:pay` and contains only fields owned by this product slice.

Required:

- `destination` — exact selected local Classic public address.

Optional:

- `amount` — positive decimal, at most seven fractional digits, preserved as an exact decimal string;
- `asset_code` + `asset_issuer` — always present together for an issued asset;
- `memo` + `memo_type` — always present together for a selected memo;
- `msg` — untrusted human-readable request context, maximum 300 characters before URL encoding;
- `network_passphrase` — omitted for Stellar Public Network and required for every non-Public network.

Parameter ordering may be canonicalized by the builder, but consumers must rely on typed fields rather than raw query order.

The builder never emits `callback`, `origin_domain`, `signature`, `xdr`, `replace`, secret material, app passphrase, mnemonic, signer envelope, local account label or internal account ID.

## Amount and asset rules

Amount is optional. Selecting “no fixed amount” removes the amount field entirely; it must not serialize as zero or an empty parameter.

A fixed amount must satisfy Stellar seven-decimal precision and be greater than zero. Binary floating point must not determine the canonical value.

The first implementation may offer only:

- native XLM; and
- ordinary issued assets that the selected receiving account currently exposes as receivable through authoritative account/balance state.

Issued-asset identity is exact `code + issuer`. Asset code case and issuer address must not be inferred from display text. Liquidity-pool shares are not Request assets.

An inactive account exposes only XLM. Request does not create a local trustline, infer issuer-self redemption, or claim an asset can be received when current authoritative state does not prove it.

Failure to load the asset choices does not make the public address unavailable; the user may still create an address-only or XLM request.

## Memo and message rules

S09 supports no memo, Text, ID and Hash memo using the same canonical rules frozen by S07.

`MEMO_RETURN` is not supported because the current Normative Payment contract does not support it. It must fail explicitly rather than being reinterpreted as Hash.

A request message is not a transaction memo and is never placed on-chain by Request itself. It is public, untrusted text carried in the URI and must not be rendered as verified merchant identity or executable content.

## Share, copy and QR contract

Copy, system Share and QR render the exact same canonical URI string produced by the Request builder.

The plain public address may be displayed separately for human verification, but the copy/share/QR Request actions must not silently switch between address-only and SEP-7 forms.

System share cancellation is not an error. A platform share failure remains on Request, preserves the generated URI and shows a localized retryable failure.

Clipboard writes contain only the canonical public request URI. Request never reads the clipboard automatically.

QR rendering is presentation only. The QR component receives an already validated canonical public URI and must not reconstruct request semantics.

No analytics, logs or diagnostics may record the full request URI when it contains memo/message text. Stable diagnostics may record only non-sensitive categories such as operation kind and failure class.

## One inbound parser for paste, scan and deep link

Paste, camera scan and OS deep-link ingress must call the same parser and produce the same typed result for identical input.

The Stage 5 parser accepts:

- an exact Classic `G...` destination as an address-only payment intent;
- `web+stellar:pay?...` with the supported fields defined below.

Everything else is rejected or explicitly classified unsupported. Entry point must not change protocol interpretation.

## Inbound validation and unsupported SEP-7 forms

For `web+stellar:pay`, destination is required and must be a Classic `G...` address under the current Fresnica Payment contract.

Recognized amount, asset, memo, message and network fields use the same canonical rules as outbound Request. Asset code and issuer, and memo value and memo type, must appear as complete pairs.

Duplicate occurrences of any recognized semantic parameter fail closed to avoid ambiguous parser behavior.

Network interpretation is explicit:

- absence of `network_passphrase` means Stellar Public Network;
- a non-Public request must carry its exact network passphrase;
- the request is accepted only when its resolved network exactly matches the app's current network.

A network mismatch is a blocking product error. S09 never silently switches network from an external request.

The following are explicitly unsupported in this Stage 5 slice:

- muxed `M...` destination;
- `web+stellar:tx`;
- `callback`;
- `origin_domain` or `signature`;
- `MEMO_RETURN`;
- path-payment/source-asset conversion;
- unknown `web+stellar` operations.

Unsupported protocol features remain distinguishable from malformed input so later Sxx work can extend them deliberately.

## Inbound route into Send

An accepted inbound payment intent never signs or submits by itself.

The router resolves the current/default visible Classic account on the matching network and opens the existing Send form with public fields prefilled. The user must still review the form, continue to exact-XDR review and explicitly authorize through the existing flow.

S09 does not auto-switch to a different local source account merely because another account owns the requested issued asset.

For an issued-asset request, the selected source account must be able to send that exact requested asset through current authoritative Payment preflight. If it cannot, the request fails closed with localized guidance instead of silently choosing XLM, another asset or a path payment.

The optional `msg` may be displayed as untrusted request context but never changes Payment preparation, duplicate-intent identity or the exact transaction.

If no eligible local source account exists, the app shows a stable blocked state and does not fabricate a Send route.

## Cold start, lock and navigation lifecycle

OS deep-link ingress is an app-level input, not a Feature-owned navigation shortcut.

Cold and warm delivery use the same typed parser. Navigation occurs only after bootstrap can resolve the active network and an eligible visible account.

If an app lock blocks entry to Main, one parsed public payment intent may be retained in memory until the user completes the existing unlock flow. It is not persisted to Realm or secure storage, and it never bypasses authentication.

Onboarding/no-account state cannot execute the intent. The product may keep the public intent in memory for the current process, but no account is created, imported or selected automatically because of a deep link.

## Scan, paste and permission boundary

The Stage 5 scanner is purpose-limited to public Stellar payment input. It does not become the Stage 7 dApp/browser scanner.

Camera permission follows the normal OS request/deny/retry/settings path. Denial leaves the user on a stable scanner state with Close and permission-recovery actions; it never falls back to an unrelated browser or hidden camera access.

Paste is explicit user action. Clipboard content is read only after the user chooses Paste/Import from clipboard.

If scan/paste content is a Stellar secret seed, mnemonic, arbitrary URL, plain text or another unsupported URI, S09 does not route it elsewhere. Secret/mnemonic-like content is classified as sensitive and rejected without echoing the full value into UI diagnostics or logs.

After one camera result is accepted for processing, duplicate frame callbacks are ignored until the parser result is handled or the user retries.

Torch state is local scanner UI state and has no bearing on parser semantics.

## Failure and retry behavior

Malformed request input remains editable/retryable at the originating entry surface when possible.

Parser failures return stable product categories rather than raw SDK/platform exceptions.

Share, clipboard, camera and deep-link platform failures do not mutate Account, Balance, Payment, pending submission or default-account state.

An inbound parse/network/asset failure never clears a previously selected account or changes persisted network/default selection.

No failure path writes a pending transaction because S09 does not enter the submission pipeline until the user later completes normal Send review/authorization.

## Localization, formatting and accessibility

All Request, parser, permission, mismatch, unsupported and retry copy enters the three locale dictionaries when its implementation slice lands.

Exact ledger values remain strings. UI formatting must not replace the canonical decimal, asset identity, address or memo used to build/parse the URI.

The Request screen must expose meaningful labels for account, amount toggle/input, asset picker, memo type/value, message, Copy, Share and QR content. The QR itself needs an accessible textual alternative containing the public destination and enabled request fields rather than requiring a screen reader to interpret pixels.

Scanner controls require explicit camera-purpose, torch, paste and close labels/states. Permission-denied recovery and parser errors remain reachable under dynamic font and screen readers.

Full dual-platform TalkBack/VoiceOver focus-order evidence is an aggregate/L4 acceptance item, not a reason to weaken the per-slice accessibility contract.

## Required incremental PR order

After this specification PR, implementation remains split:

1. **Typed Request URI domain:** canonical DTO, SEP-7 pay builder/parser, network resolution and exhaustive validation tests; no UI/platform effects.
2. **Request product surface:** route enablement, Classic-account eligibility, optional amount/asset/memo/message, canonical copy/share/QR projection using injected platform ports.
3. **Paste/scan platform ingress:** clipboard and camera ports, permission/deny/retry states, duplicate-frame guard and the same typed parser.
4. **OS deep-link ingress:** register `web+stellar` handling, cold/warm bootstrap routing, current/default account binding and mismatch/blocked states.
5. **Send prefill integration:** typed intent to existing Send form only; Payment/exact-XDR/sign/submit/recovery remain authoritative and unchanged.
6. **Dual-platform aggregate acceptance:** Request build → copy/share/QR round-trip → scan/paste → deep link → Send prefill, plus network/asset/permission/failure/restart cases.

No implementation PR may add S08 muxed semantics, SEP-7 `tx`, callback/signed-origin verification, Swap/path payment or dApp/browser behavior merely because the shared parser sees those forms.

## Required acceptance

Domain tests must prove at minimum:

- outbound address-only, amount, issued asset, Text/ID/Hash memo, message and Testnet network-passphrase round trips;
- Public Network omission versus non-Public exact network-passphrase behavior;
- invalid/zero/over-precision amount rejection;
- asset code/issuer pair integrity and exact identity preservation;
- invalid memo and `MEMO_RETURN` rejection;
- muxed destination rejection under the current S08 boundary;
- callback, signed-origin and SEP-7 `tx` explicit unsupported classification;
- duplicate recognized parameter rejection;
- identical parser output for paste/scan/deep-link carriers;
- no secret/mnemonic value in accepted S09 intent or diagnostics.

Product/native acceptance must prove canonical Copy/Share/QR equivalence, account/network stability, denied-camera recovery, successful scanner/paste round trip and cold/warm deep-link routing without auto-signing.

## Maturity boundary

The behavior-spec PR does not promote S09 above its current unimplemented product maturity.

S09 may reach L3 only after the user-reachable Request surface plus paste/scan/deep-link paths are wired through production ports and accepted on Android and iOS.

L4 additionally requires the aggregate flow to become a repeatable required gate plus trustworthy dynamic-font and platform screen-reader focus-order evidence.

Stage 5 completion does not unblock S08 muxed destinations, SEP-7 transaction signing or Stage 7 dApp authorization; those remain independently tracked capabilities.
