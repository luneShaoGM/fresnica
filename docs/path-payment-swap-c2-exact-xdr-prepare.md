# S10 / Stage 6 — Swap-C2 unsigned Path Payment preparation and exact-XDR review

Status: **isolated Capability and SDK adapters; Work independent review pending; no App entry, signing, authorization or submission**.

Contract: [Fresnica/fresnica PR #188 Path Payment/Swap Normative](https://github.com/Fresnica/fresnica/blob/38e804b435be5d3c6a0400de4e79f102822cb8e0/docs/capabilities/path-payment.md). The unchanged upstream test vector spec/test-vectors/path-payment-v1.json has Git blob c5252a572522c8eadb2fb42f0244373921e1688f.

## Accountable preparation boundary

The new **preparePathPayment** takes an explicit selected quote, slippage in basis points, transaction fee in stroops and separate transaction timeout seconds. It returns an immutable **PreparedPathPaymentReview** with the **unsigned** exact XDR, source/destination account and asset identity, network, original quoted values, ordered intermediate path, fixed side amount, Memo, fee and transaction expiry, plus the strict-mode slippage limit.

1. Reject invalid fee, timeout, network, wallet and path **before ledger I/O**. Allow at most five intermediate Classic assets, with no endpoint repetition. Snapshot the exact quote/route and fee/slippage/timeout values; detect mutations across awaited calls.
2. Run Swap-B integer slippage and **existing Swap-C1 live ledger preflight with the actual fee**. C1 now rejects a fee below live network base fee and checks native reserve/availability using the selected fee; other C1 callers retain base-fee default. C1 checks quote expiry and account/issuer/trustline identity.
3. Construct separate Transaction TimeBounds with minTime = 0, maxTime = floor(nowUnixMs / 1000) + explicit timeout in 1..3600 seconds. This **does not extend the quote's 30-second TTL**. SDK build takes required absolute expiry, optional validated Memo and verifies the Horizon-loaded source account identity.
4. Build one PathPaymentStrictSend or PathPaymentStrictReceive with the **selected** exact source/destination assets, intermediate path, fixed-side amount, BigInt-derived limit, Memo, source, fee and network passphrase. No rerouting, price refresh or alternative quote is introduced.
5. **After** awaiting the SDK builder, verify full network context, unchanged quote/options and **repeat C1 live preflight and Swap-B expiry/slippage**. An expired quote or changed ledger fails closed. No reusable C1 approval is created.
6. Independently parse the **actual XDR** rather than trusting builder arguments or returned metadata. Require precisely one unsigned Path Payment operation with no operation-level source override, extra ledger bounds/sequence restrictions/extra signers or unlimited TimeBounds. Decode and compare source/destination, complete case-sensitive asset and issuer identities, ordered path, exact amounts, protection limit, Memo, fee and selected absolute TimeBounds. Differences fail with path_payment_review_mismatch; independently repeat expiry and network checks before returning.
7. Return a frozen review. Any change of path, quote, amounts, slippage, destination, Memo, fee, transaction window or network requires a new prepare and review. This stage **does not create a reachable signing or submit route**.

## Explicit limits and follow-on gates

- The SDK network passphrase is checked against current network and used to decode the envelope. Stellar XDR does not encode the passphrase; future signer/Transaction Capability must bind the **same passphrase and exact reviewed XDR** and never infer network correctness from XDR alone.
- Preparation does not reserve account sequence, path liquidity, trustline limits, issuer authorizations or offers. Ledger execution may still reject cross_self or shifting liquidity; no successful result is fabricated.
- Once prepared, the transaction follows its **independent XDR TimeBounds**, not quote expiry. Expiry after uncertain submission does not prove rejection; Swap-D must reconcile the original exact transaction rather than re-quote blindly.
- No App/Swap UI, authorization, signing, submission, pending/reconciliation, Realm write, SDEX or Soroban Swap is included. Hardware/multisig and native device testing remain deferred; Jest and JS bundles are not native validation.
- Test coverage includes both modes, Memo text/id/hash, full SDK XDR decode, actual C1+SDK composition, invalid/mutable route/fee/options and clock, malformed/multi-op/signed/overridden/extra-precondition XDR. The official vectors remain intact but this Slice is **not an end-to-end path execution**.
- **S10 remains L2 partial** even after reviewed merge. The next work is Swap-D authorization/sign/submit/reconciliation, then product UI and combined acceptance; the transaction review must never be bypassed.
