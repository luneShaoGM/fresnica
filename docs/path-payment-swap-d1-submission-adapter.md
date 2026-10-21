# S10 / Stage 6 — Swap-D1 reviewed Path Payment submission bridge

Status: **isolated Capability adapter; independent exact-HEAD Work review required; no App/Swap UI composition**.

Authority: upstream Fresnica/fresnica PR #188 Path Payment Normative contract, unchanged official path-payment-v1.json vectors; Mobile Swap-A/B/C1/C2 PR #102/#103/#104/#105 already independently reviewed and merged. The existing S07 Payment and S30 Trustline transaction recovery paths are reused, not duplicated.

## New adapter

The new submitReviewedPathPayment function receives a Swap-C2 PreparedPathPaymentReview, the active Classic wallet identity, bound network context, a single attached local software signer, and the existing SDK, Transaction Gateway and pending-submission dependencies.

Before any asynchronous authorization or signing, it checks all three bound network contexts (active context, transaction gateway, Path Payment XDR inspector) for the exact ID **and passphrase**. It independently decodes the **actual unsigned XDR** through the existing SDK inspector and matches it against the retained review and its detached frozen quote:

- source and destination Classic identities, source/destination assets with exact case-sensitive code/issuer, ordered path and optional Memo;
- strict-send or strict-receive mode, exact fixed-side amount and original quote amounts;
- fee, XDR TimeBounds, source/destination limit, and independently recomputed BigInt 0–1000bps integer-slippage bound;
- no same-asset Swap, source/destination endpoint repeated in path or more than five intermediate hops.

The adapter **does not reapply the quote's 30-second fetch TTL at signing time**. Once a prepared transaction exists, its own signed-XDR TimeBounds define transaction freshness. The shared submitReviewedTransaction function enforces this TimeBounds before authorization.

## Signer and shared transaction path

The selected protected signer must be the **sole local signer attached to the current account**. Watch-only, unattached or multi-signer input is not guessed or auto-authorized; the adapter returns unsupported-signer. Signer fields are snapshotted before awaiting ledger authorization or System Auth, and the account/signer attachment is rechecked after ledger loading, after signing and immediately before broadcast. The existing Transaction Capability continues to enforce medium ledger threshold and local signer authorization.

A frozen minimal reviewed transaction is passed into the shared submitReviewedTransaction pipeline, which already implements System Auth/passphrase fallback, exact reviewed-XDR signing, persistence of a submitting record **before** network broadcast, accepted/rejected/uncertain outcomes and pending economic-intent blocking. No alternate broadcast state machine, Realm schema or cryptographic signer is added.

The stable economic-intent key uses source, destination, both assets, swap mode, exact user-fixed amount and Memo. It deliberately **excludes** chosen route, quoted variable-side amount, slippage, fee and newly built XDR; otherwise re-quoting could bypass an unresolved earlier same-trade submission. The existing pending repository scopes keys by network ID and wallet account ID.

Network/account rebind before signing or broadcast fails closed. If network identity changes or a transport exception occurs **after broadcast may have started**, the existing pending record is marked uncertain rather than treating the submission as rejected or retrying it. Existing reconcilePendingSubmissions remains the only way to resolve unknown hashes on the correct network.

## What remains incomplete

This is a Capability integration slice. There is **no user-facing Swap entry**, final signing confirmation UI, flow navigation/account/network-switch UX, new background recovery controller, live Testnet execution, device approval or external/hardware/multisig support. The later Swap-D2/product composition must route results and resume unresolved submissions through the existing persistence and recovery machinery, and Stage 9 remains responsible for deferred physical-device System Auth acceptance.

Tests use mocked authorization/sign/broadcast ports and an **actual Stellar SDK-built Path Payment XDR** for independent inspector validation. These tests never submit a real transaction to Horizon. GitHub CI, Realm tests and Android/iOS JavaScript bundles do **not** count as native device or mainnet/testnet execution evidence. S10 stays **L2 partial** until product composition and higher-level acceptance gates are met.
