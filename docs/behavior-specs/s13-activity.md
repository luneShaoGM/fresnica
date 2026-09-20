# S13 Activity behavior specification

Status: frozen for the Stage 4 S13 Activity closure starting from `main@883cf4667e7246fd88a9718ef4695a92db68ce2f`.

Trace ID: `S13` — Activity list/filter/search/detail/participants.

Provenance: clean-room behavior rewrite. Donor Activity/Events surfaces are product-role references only; donor source, repositories, helpers, tests, component structure and resources are not implementation templates.

## Scope and authority

S13 is a read-only product slice over the existing History capability and Horizon authority.

This closure does not modify Payment, Trustline, Signing, Transaction, XDR or Stage 2.5 submission/reconciliation semantics. It does not add any contextual action that writes to the Stellar ledger. A future write action discovered from Activity must be owned by its corresponding Sxx and reuse that capability's review/sign/submit/recovery contract.

Horizon remains authoritative. S13 must not infer complete history from local state, must not fabricate operations, and must not describe pagination as gap recovery.

## Baseline inventory

At the frozen baseline:

- `StellarSdkGateway.loadAccountOperations` reads descending Horizon account-operation pages and derives the next cursor from the last record of a full page;
- History maps stable common fields and specializes `payment` and `create_account`;
- unknown operation types and malformed specialized shapes remain explicit `unsupported` entries;
- Activity appends later pages with operation-ID deduplication, exposes loading/inactive/unsupported/error/empty/refresh/load-more states, and ignores stale requests after account/request changes;
- filter and search are client-local over entries already loaded into the mounted Activity screen;
- operation-details navigation carries only `accountId + operationId`; the detail reloads the single Horizon operation and validates operation identity and account association;
- Activity and details re-read on focus/invalidation revision;
- no persistent History cache, participant model, network-aware explorer action or screen-level Activity UI regression suite exists yet.

PRs after this specification close those gaps incrementally rather than replacing the existing History boundary.

## Page, cursor and ordering contract

The first page is a descending Horizon account-operations page. Later pages use only the opaque cursor returned by the History gateway.

The product order is the gateway order. Feature code must not re-sort operations by formatted date, localized text, amount or operation type.

Merging a later page follows these rules:

1. preserve all already-loaded entries in their current order;
2. append incoming entries in gateway order;
3. deduplicate by stable operation `id`;
4. keep the first loaded copy of a duplicate because ledger operations are immutable;
5. retain the gateway's next cursor even when an overlapping page contributes no new rows, provided the cursor advances;
6. a repeated/non-advancing cursor must fail closed as a load-more error instead of creating an infinite pagination loop.

A short page has no next cursor. Reaching the end leaves the loaded entries visible and removes the load-more affordance.

## Initial load, refresh and error recovery

Initial load failure shows the full Activity error state with a retry action.

Manual refresh may first request existing transaction reconciliation, but reconciliation is best-effort for this read path. A reconciliation failure does not suppress the subsequent Horizon read.

A successful refresh replaces the loaded page set with a fresh page 1 and its new cursor. It does not append the old page set.

If refresh fails after a successful list has already been loaded, the last successful entries remain visible and the failure is retryable. Activity must not erase a previously valid list merely because a refresh failed.

Load-more failure also preserves the current entries and the cursor that failed. Retrying uses that same cursor. A load-more failure must not silently advance pagination.

Changing the selected account invalidates the loaded page set and resets filter/search to their defaults. Opening details and returning, or refreshing the same account, preserves the current filter/search. Process restart resets filter/search because S13 does not introduce persistent presentation preferences.

## Search and filter boundary

Search and filter operate only over the pages currently loaded in the Activity session.

They do **not**:

- issue a Horizon search query;
- claim to search the account's full ledger history;
- auto-page until a match is found;
- use a local UX cache as authoritative history.

If a replaceable UX cache is added later, cached entries may feed the same loaded-page presentation contract while a refresh runs, but cache/gap recovery is outside this S13 closure.

The frozen filters are:

- `all`;
- `payments`;
- `accounts`;
- `trustlines`;
- `other`.

Filter and search combine with logical AND. Newly loaded pages are immediately included in the active filter/search. Clearing both conditions restores every entry in the currently loaded page set without another network request.

Search is case-insensitive for ASCII ledger identifiers and matches stable normalized/presentation fields only:

- localized operation title;
- operation type;
- operation ID;
- transaction hash;
- participant public identities;
- asset code and issuer when present;
- exact ledger amount/limit text when present.

No fuzzy matching, contact lookup or server-side expansion is part of this slice.

## Specialized operation families

This Stage 4 closure specializes the operation families produced by currently closed local-wallet write paths:

### Payment — Horizon `payment`

Stable projection preserves direction, exact amount string, full asset identity and participants.

Participants are:

1. `sender`;
2. `recipient`.

For a muxed destination, the participant display identity preserves the muxed address while the base account identity remains available for account-association logic. Feature code must not reconstruct this relationship from raw Horizon fields.

### Account funding — Horizon `create_account`

Stable projection preserves direction, exact starting balance and participants.

Participants are:

1. `funder`;
2. `created-account`.

### Trustline change — Horizon `change_trust`

Stable projection preserves the exact asset code/issuer and exact limit string for ordinary issued-asset trustlines.

Participants are:

1. `trustor` — the operation source account;
2. `issuer` — the issued-asset issuer.

A zero limit can be presented as trustline removal. A positive limit must **not** be guessed as “Add” versus “Set Limit”, because the operation record alone does not prove whether the trustline existed before the transaction. Positive-limit presentation therefore remains “Trustline changed” plus the resulting limit.

Liquidity-pool-share ChangeTrust and malformed/unsupported asset shapes remain explicit unsupported entries in this closure; S13 must not invent a partial LP product model ahead of S12.

### Other operation types

All other Horizon operation types remain visible as explicit `unsupported` entries with stable common fields. They are grouped under the `other` filter.

Unsupported entries must never be dropped merely because the app lacks a specialized family projection.

Future Sxx slices may add their corresponding read projection independently. S13 does not pre-implement every Stellar operation family before the owning product capability exists.

## Participant model

Participants are stable History DTO data, not Feature inference.

Each specialized participant has:

- a semantic role;
- a public ledger identity for display;
- an optional base account identity when a displayed muxed identity differs from the account used for association.

Participant order is semantic and stable per operation family as listed above. The same public account may appear under more than one role when the ledger operation genuinely has multiple roles.

The common `sourceAccount` remains a separate operation field. Unknown operations do not fabricate participant roles from fields whose semantics S13 does not understand.

No secret, signer material, local account label or contact/private metadata enters the participant DTO.

## Detail and warning contract

Operation detail always reloads the single operation through History, validates exact operation ID and selected-account association, and distinguishes:

- loading;
- transport/error;
- not found;
- not associated;
- unsupported account;
- ready specialized entry;
- ready unsupported entry.

Specialized details show common fields plus family fields and participants.

An unsupported operation-type entry shows an explicit localized unsupported warning and common ledger fields. A malformed known-family entry shows an explicit localized “details unavailable for this operation shape” warning rather than pretending it belongs to another family.

Warnings are descriptive read-model warnings only. They are not transaction-security verdicts and must not trigger ledger writes.

## Network-aware transaction explorer

The detail surface may offer one read-only **View transaction in explorer** action when the current network and transaction hash are supported.

Explorer URL construction is outside Feature/History DTO mapping. It consumes `networkId + transactionHash` and returns an optional HTTPS URL.

Frozen network mapping:

- `stellar-testnet` → `https://stellar.expert/explorer/testnet/tx/<transactionHash>`;
- `stellar-mainnet` → `https://stellar.expert/explorer/public/tx/<transactionHash>`.

Unknown/custom networks expose no explorer action until their explorer policy is configured. The Feature must not guess a public-network URL.

The hash must be a valid 64-character hexadecimal transaction hash before an external URL is offered. Opening the explorer sends only the public network selection and transaction hash.

This action is read-only. “Send again”, “remove trustline”, “claim”, “cancel offer” or any other ledger mutation is outside S13.

## Localization, formatting and accessibility

History DTOs retain exact ledger strings. Formatting belongs to the product surface.

All new titles, family names, participant roles, warnings, filters, retry states and explorer copy enter all three locale dictionaries.

Dates use the active locale. Amounts/limits use the existing localization/number-formatting boundary without floating-point policy in History.

Interactive rows, filter controls, search, retry/load-more and explorer actions require explicit accessibility roles/labels/states where the native primitive does not already expose sufficient semantics.

Dynamic-font layout and TalkBack/VoiceOver traversal are aggregate acceptance items. Exact focus order is not claimed closed without trustworthy platform evidence.

## Required incremental PR order

After this spec PR, implementation remains split:

1. **History/read-model integrity:** cursor progression guard, stable merge/order tests, refresh-preserves-data failure state, load-more retry behavior.
2. **Operation-family projection:** stable participant DTO plus `change_trust`; existing payment/create-account remain compatible; unsupported fallback stays explicit.
3. **Filter/search closure:** add trustline filter and test loaded-page-only search/filter across pagination, clearing conditions and refresh.
4. **Product hardening:** detail warnings, network-aware explorer, screen-level retry/error regression coverage, three-language copy, dynamic-font/accessibility fixes.
5. **Aggregate evidence:** fresh Android+iOS `list → pagination → filter/search → detail → participants → refresh/retry → restart`.

Each implementation PR must preserve the read-only S13 boundary and must not modify Payment, Trustline write semantics, Signing, Transaction, XDR or recovery.

## Aggregate acceptance boundary

S13 may be considered for promotion from `L3 partial` to `L3 / L4 partial` only after both Android and iOS prove the frozen aggregate sequence against production History/Horizon wiring.

A successful aggregate does not by itself establish L4. Required repeatable aggregate gating and trustworthy platform-level screen-reader focus-order depth remain separate L4 evidence.
