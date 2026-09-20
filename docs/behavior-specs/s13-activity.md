# S13 Activity behavior specification

Status: frozen for the Stage 4 S13 Activity closure starting from `main@883cf4667e7246fd88a9718ef4695a92db68ce2f`; amended after operation projection/participants merged at `main@8d3aba7f5aa5875364402e9a87d828dfd66f9345` to bring the previously deferred persistent UX cache into the S13 construction sequence.

Trace ID: `S13` — Activity list/filter/search/detail/participants/offline UX cache.

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
5. retain the gateway's next cursor even when an overlapping page contributes no new rows, provided the cursor is new to the current accepted pagination chain;
6. treat cursors as opaque tokens: never parse, numerically compare or lexicographically order them;
7. after a successful page response, a defined `nextCursor` advances only when it differs from the cursor used for that request and is absent from the set of cursors already accepted for the current loaded page set; equality with the request cursor or any previously accepted cursor is a pagination cycle and must fail closed as a load-more error;
8. add a cursor to the accepted set only after that page response is successfully accepted, so a transport/load failure can retry the same request cursor without being misclassified as a cycle.

The accepted cursor set is reset when page 1 replaces the page set, including account changes and successful refresh. A short page has no next cursor. Reaching the end leaves the loaded entries visible and removes the load-more affordance.

## Initial load, refresh and error recovery

Initial load failure shows the full Activity error state with a retry action.

Manual refresh may first request existing transaction reconciliation, but reconciliation is best-effort for this read path. A reconciliation failure does not suppress the subsequent Horizon read.

A successful refresh replaces the loaded page set with a fresh page 1 and its new cursor. It does not append the old page set.

If refresh fails after a successful list has already been loaded, the last successful entries remain visible and the failure is retryable. Activity must not erase a previously valid list merely because a refresh failed.

Load-more failure also preserves the current entries and the cursor that failed. Retrying uses that same cursor. A load-more failure must not silently advance pagination.

Changing the selected account replaces the in-memory loaded page set with that account/network partition's cached snapshot, when one exists, and resets filter/search to their defaults. Opening details and returning, or refreshing the same account, preserves the current filter/search. Process restart resets filter/search because S13 does not persist presentation preferences even though it may restore cached ledger entries.

## Persistent UX cache and offline contract

The Activity cache is a replaceable public-ledger UX snapshot. Horizon remains authoritative. Cached data must never be described as complete account history, gap recovery or proof of the latest ledger state.

Ownership remains layered:

- History Capability defines the cache port and normalized snapshot contract without importing Realm;
- `platform/persistence` implements the port, schema, migration/clear policy and atomic storage;
- App composition injects the cache into the History/Activity read model;
- Activity Feature renders cache provenance/freshness state but never imports Realm or interprets persistence records.

Cache partitions are isolated by `networkId + classic account address`. A cached detail is further keyed by exact operation ID. Local account label, secret, signer material, App Passphrase, mnemonic, envelope/XDR and pending-transaction private workflow state never enter the History cache.

A list snapshot contains only normalized History DTOs in accepted gateway order plus its schema version and last successful Horizon update time. Any ready detail projection may be cached only after exact operation-ID and selected-account association validation. This includes specialized entries and explicit unknown-operation or malformed-known-family `unsupported` entries; transport errors, not-found, not-associated and other non-ready outcomes are never cached. Cache writes occur only after a Horizon page/detail result has been successfully accepted. A cache write failure does not turn a valid Horizon result into a product failure; the live result remains usable but is not represented as durably available offline.

The product uses stale-while-revalidate behavior:

1. on mount, focus or process restart, a matching cached snapshot may be displayed immediately;
2. cached content is visibly marked as cached/stale and exposes a localized last-updated value until current Horizon revalidation succeeds;
3. online revalidation requests a fresh page 1; success replaces the in-memory loaded page set, resets the cursor chain and atomically updates the durable cache using the continuity rule below;
4. revalidation failure preserves cached/previously loaded entries and shows a retryable degraded state without presenting them as current;
5. when no matching cache exists, an initial Horizon failure continues to use the full error state;
6. offline mode permits reading matching cached list/detail projections but never fabricates unavailable operations or silently falls back across network/account partitions.

Persisted cache is display-only until a successful page-1 revalidation establishes a new in-memory pagination chain. The product must not resume load-more from a persisted cursor or accepted-cursor set. Load-more is therefore unavailable while showing an unrevalidated restored snapshot. This preserves the opaque-cursor/cycle rules and prevents a stale cursor from being presented as continuous history.

Page-1 revalidation does not unconditionally discard a longer durable snapshot. Continuity is established only by stable operation-ID overlap, never by parsing or ordering cursors:

1. the in-memory online page set always starts from the newly accepted page 1 and its new cursor chain;
2. when the fresh page and prior durable snapshot share at least one operation ID, the durable snapshot becomes the fresh page followed by the prior cached suffix after the oldest overlapping fresh-page operation, with operation-ID deduplication and the existing gateway order preserved;
3. when there is no overlap, continuity is unproven, so the durable snapshot fail-closes to the fresh page only rather than retaining a possibly gapped tail;
4. accepted load-more pages extend both the current in-memory page set and durable snapshot only after the existing cursor/cycle checks pass;
5. the final durable snapshot is atomically written and trimmed to the retention bound.

Each `networkId + account` partition retains at most the newest 500 accepted entries. Trimming preserves gateway order and removes older entries/details outside that bound. Cache schema incompatibility or corrupt data clears only the affected replaceable cache partition and falls back to Horizon; it must not affect Account, Signer, Account-Signer Reference or Transaction/pending records.

There is no age-based rule that silently promotes cached data to fresh or deletes the only offline-readable snapshot. Age is always derived from the last successful Horizon update and presented honestly; capacity/schema/account-deletion policies, not a fabricated freshness TTL, control removal.

Submitting or reconciling a transaction marks the matching Activity partition stale and triggers the existing read invalidation path; it does not delete the last usable cache snapshot or mutate a cached operation optimistically. Manual refresh, focus/foreground revalidation and definite offline-to-online recovery may refresh the partition through the same History authority. Deleting a local account removes its History cache partitions. Switching account or network never reuses another partition.

## Search and filter boundary

Search and filter operate only over the current loaded set. Before successful revalidation, that set may be the matching restored cache snapshot; after successful page-1 revalidation it is the newly accepted Horizon page set plus pages loaded in the current session.

They do **not**:

- issue a Horizon search query;
- claim to search the account's full ledger history;
- auto-page until a match is found;
- use a local UX cache as authoritative or complete history.

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

Ownership is explicit:

- **History Capability** owns only the normalized public ledger fields, including `transactionHash`; History DTOs never contain explorer URLs or invoke external navigation.
- **Network Capability** owns explorer policy. Given `networkId + transactionHash`, it validates the public transaction hash, applies the configured network-to-explorer mapping and returns either a trusted HTTPS URL or no action. Activity must not duplicate this mapping.
- **Activity Feature** consumes that optional projection and decides only whether to render the localized explorer action; it does not build URLs and does not call React Native `Linking` directly.
- **Platform** owns the external-navigation side effect behind an injected external-URL port. App composition wires the Network Capability projection and Platform opener into the Activity surface. The Platform opener does not reinterpret network policy or rewrite the URL.

Frozen Network Capability mapping:

- `stellar-testnet` → `https://stellar.expert/explorer/testnet/tx/<transactionHash>`;
- `stellar-mainnet` → `https://stellar.expert/explorer/public/tx/<transactionHash>`.

Unknown/custom networks return no explorer projection until their explorer policy is configured. The Feature and Platform layers must not guess a public-network URL.

The Network Capability offers an explorer URL only for a valid 64-character hexadecimal transaction hash and an allowlisted HTTPS explorer origin/path for the selected network. Opening the explorer sends only public network context encoded in that URL and the public transaction hash.

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
3. **Cache/repository integrity:** Capability-owned cache port, Realm schema/repository, network/account isolation, atomic accepted-snapshot writes, 500-entry trimming, reopen/corruption/account-deletion coverage.
4. **Cache hydration/offline product state:** cached list/detail hydration, stale/last-updated presentation, background page-1 revalidation, no-cache and cache-write failure behavior, offline/read-retry/restart coverage; persisted cursors never resume pagination.
5. **Filter/search closure:** add trustline filter and test current-loaded-set search/filter across cached hydration, successful revalidation, pagination, clearing conditions and refresh.
6. **Product hardening:** detail warnings, network-aware explorer, screen-level retry/error regression coverage, three-language copy, dynamic-font/accessibility fixes.
7. **Aggregate evidence:** fresh Android+iOS `online load → restart/cache hydrate → offline list/detail → reconnect/revalidate → pagination → filter/search → detail → participants → refresh/retry`.

Each implementation PR must preserve the read-only S13 boundary and must not modify Payment, Trustline write semantics, Signing, Transaction, XDR or recovery.

## Aggregate acceptance boundary

S13 may be considered for promotion from `L3 partial` to `L3 / L4 partial` only after both Android and iOS prove the frozen aggregate sequence against production History/Horizon/Realm wiring, including honest cached/offline presentation and successful revalidation.

A successful aggregate does not by itself establish L4. Required repeatable aggregate gating and trustworthy platform-level screen-reader focus-order depth remain separate L4 evidence.
