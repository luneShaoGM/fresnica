# Account data lifecycle and foreground synchronization

Status: implementation candidate on main baseline `589a75ba5a97b305b94b15b7aff6be62067c8bc9`. This specification covers the S05/S13 lifecycle maintenance slices. It does not promote their product maturity or replace the Transaction recovery contract.

## Ownership and source decision

Maturity gate: Phase 0 passed; existing Phase 2a/2b injection and navigation are reused. This is maintenance of the existing S05 Balance and S13 History read surfaces, not authorization to begin an unrelated ledger-write capability. App read-model scopes join strict architecture enforcement.

Reference role: application lifecycle, connectivity recovery and account data freshness. Decision: Adopt recovery behavior, Adapt to Fresnica's app/capabilities/platform/features boundaries, Exclude global service singletons, cached balances as authority and history gap recovery. Implementation is independently written from behavior and Fresnica ports. No donor files, comments, tests or resource assets are migrated; independent implementation review remains required before merge.

App owns lifecycle subscriptions and public read activity. Platform reports connectivity and implements I/O. Balance/History retain their current authority and DTO contracts. Features own presentation and read only matching partitions. Transaction authorization, preparation, signing, submission and pending reconciliation keep their existing live gateway and exact-XDR guarantees.

## LC1 Lifecycle refresh and display read lifetime

LC1 is the current implementation batch. Its user-visible outcome is automatic revalidation on foreground/network recovery even when there are no pending local transactions.

1. On active startup, refresh revisions for visible accounts on the configured network and independently reconcile pending transactions. Hidden and other-network accounts are excluded. Revision changes themselves never fetch every account; focused screens read their current account.
2. Returning to active from any non-active state refreshes the current inventory independently of pending outcomes. Repeated active callbacks do not retrigger. Inactive pauses display reads but does not cancel or authorize a signing/submission operation and does not imply an application lock.
3. Connectivity is online, offline or unknown. Initial unknown permits reads through the existing gateway. The first definitive online event can retry an initial failure without requiring an earlier offline event. Once offline is known, unknown does not silently promote it to online.
4. Definite offline marks current-network public reads stale, stops dispatching new display requests and prevents pending reconciliation from starting through this lifecycle entry point. Returning online refreshes and reconciles only when foreground. A background recovery is remembered and applied on foreground return.
5. Home, Asset Details, Activity and Operation Details load automatically only when both focused and foreground. Activity may hydrate cached content while foreground but offline; an offline read failure retains its existing degraded-cache behavior. LC1 does not add a Balance cache.
6. Concurrent identical display reads share an in-flight request for the same parameters and account revision. Completed results are not cached by the request gate. A failure can be retried. A new invalidation requires a new request rather than reusing the older revision.
7. Background/foreground and connectivity changes replace the runtime generation. Display results from older generations or older account revisions are rejected before presentation/cache consumption, including active → background → active transitions. Requests queued before a generation change must not start afterward.
8. List coalescing includes address, cursor and limit. Operation lookups require the requesting account address and include it with the operation ID in their coalescing key. They use that account revision for both request sharing and stale-result rejection; account-association validation remains in History. There is one configured network/gateway per service container; dynamic endpoint changes must create a new container/session until LC4 defines an explicit endpoint generation.
9. Unsubscribe is idempotent and ignores late native callbacks. Disposal pauses new display reads. An underlying request may still finish because cancellation is not exposed by existing gateway ports; its obsolete success must not be accepted. Existing in-flight transaction recovery shutdown semantics are not changed by LC1.
10. Lifecycle refresh failures are diagnosed separately from transaction results. A reconciliation failure must not prevent the independent public read invalidation. No synthetic transaction hash is created for lifecycle refresh.

LC1 changes no database schema, cached ledger authority, signer material, transaction retry or navigation destination. Existing transaction invalidation callers remain compatible. No new dependency is needed.

## Remaining delivery batches

| Slice | Required behavior | Current state |
| --- | --- | --- |
| LC2 Balance display cache | Partitioned normalized public snapshots; schema/migration, corrupt-cache handling, best-effort writes, retain old data on refresh error; Home and asset detail show freshness | Planned, separate persistence slice |
| LC3 Foreground real time | Selected account Effects subscription across tabs; handshake/recovery reconciliation, event deduplication and coalescing, dirty revisions, opaque cursor, polling fallback, reconnect and silent-stream health check | Planned, must not be claimed delivered by LC1 |
| LC4 Node recovery and post-submit convergence | Separate device connectivity from node health; timeout/rate-limit/backoff, one retry owner, diagnostics, endpoint-generation isolation and bounded post-submit read retries without resubmission | Planned |
| LC5 Other lifecycle consumers | Per-kind cache TTL/failure policy; registry/metadata/claimable/catalog/icons/resolver; initial link/notification readiness and deduplication; appearance/browser cleanup | Planned by owning product slices |
| LC6 Aggregate acceptance | Deterministic races, Realm integration where relevant, Android/iOS actual external receipt and recovery flows | Pending |

Foreground receipt scope begins with the selected account, independent of visible Tab. All-account notifications require an explicitly expanded subscription scope and resource policy. Background/killed-app push remains subject to trusted Backend/Push contracts. Generic session lock remains upstream-blocked and cannot be simulated with a local PIN or boolean.

Proposed LC3 normal-network acceptance target: within five seconds after the receipt is queryable from the connected Horizon, update the visible selected-account balance and trigger History page-one refresh. The target must be verified on Android and iOS; fallback polling has its own interval and visible degraded state. Effects are invalidation hints, never arithmetic instructions or authorization facts.

## Acceptance and evidence

LC1 deterministic checks must cover no-pending foreground refresh, first unknown → online, offline → unknown → online, background network recovery, latest account inventory, hidden/other-network isolation, duplicate native events, disposal, identical-request coalescing, parameter separation, generation/revision races, failure retry and the unchanged transaction recovery suite. Navigation wiring must enforce focus plus foreground for all four display routes.

LC1 device checks remain required: foreground/background while Home/Activity are open, flight mode recovery, offline cached Activity and Try again, no-pending external receipt while backgrounded followed by foreground, plus duplicate listener checks after restart. Unit tests are not device acceptance. Record exact HEAD and evidence before maturity promotion.

LC2–LC6 additionally cover actual long-lived foreground receipt, switching accounts/nodes during requests, funding an inactive account, subscription handshake races, stream failure/recovery, rate limits and node outages, process restart with caches, schema migration, deletion and external-input/session changes.

## LC1 local development evidence

- `npm run check`: 132 suites / 1000 tests passed; typecheck, lint (0 errors / 21 warnings), alias/architecture, product-flow harness syntax, locale and provenance gates passed. Donor gate: 551 source files, zero unapproved exact donor blobs, zero direct-migration markers.
- `npm run test:realm`: three suites / 52 tests passed. No Realm schema or repository migration changed in LC1.
- Android and iOS release JavaScript bundles passed with a temporary external Metro config that permits reading the original installed dependencies from this isolated checkout. No dependency or shipping Metro configuration change is included. The pre-existing React Native FeatureFlags export warning remains nonfatal.
- New deterministic coverage adds the LC1 recovery/coalescing/generation cases above, failed request retry and subscription-setup cleanup. This is local development evidence, not independent exact-HEAD review or device product acceptance.
- Not run: native rebuild/install and actual device foreground/offline/external-transfer flows. Continuous foreground receipt still requires LC3. Existing in-flight transaction recovery at service shutdown is not cancelled by LC1 and remains separate from the display-read lifetime guarantees.

## LC1 operation detail review repair

Independent review of `d1cc8c554faf72ff22182159d93101ca9245572b` found that an in-flight operation lookup could bypass account revision invalidation and share an older not-found result with the new detail refresh. Operation lookup now requires the requesting account address through the History port, and display coalescing and completion checks use that account's revision. Horizon still receives only the operation ID; returned-record account association remains mandatory in History.

The new regression ran against the reviewed implementation and failed because the old request resolved not-found instead of being rejected. It now passes through the real History detail loader. A second regression proves same-operation requests for different accounts remain separate and invalidating one account preserves the other's in-flight request.

Repair validation: `npm run check -- -- --watchman=false` passed 132 suites / 1002 tests and all earlier check stages, lint 0 errors / 21 warnings. Watchman was disabled after the local sandbox prevented its client from starting; no shipping configuration changed. Realm integration passed three suites / 52 tests. Android and iOS release JS bundles passed using the existing temporary external Metro config. Native/device acceptance and new exact-HEAD independent review remain pending.
