# S07 Send memo-family behavior spec

Status: frozen for the Stage 4 Send memo-family slice on 2026-09-17.

## Scope

This slice extends the existing classic-account Send product flow from optional text memo to the three outbound memo families already required by the Stage 4 plan:

- no memo;
- text memo;
- ID memo;
- hash memo.

It does not add `MEMO_RETURN`, muxed `M...` destinations, a second submission/recovery pipeline, optimistic balance writes, or any new signer/session-unlock semantics.

## Authority and exact-XDR boundary

The unsigned transaction XDR remains the review and signing authority. Form state is only build input and must not be trusted again at submission time.

After build, Payment must inspect the exact unsigned XDR and project the memo as a typed canonical value. Review-context validation must compare that typed memo with the canonical preflight value. Submission must re-inspect the exact XDR before signing, as it does today.

## Canonical memo rules

- **None:** represented by absence of a memo in the capability/build/review contract.
- **Text:** empty string means no memo. Non-empty text is preserved byte-for-byte as entered, including semantic leading/trailing whitespace, and must be at most 28 UTF-8 bytes.
- **ID:** surrounding UI whitespace is ignored. A selected ID memo must contain decimal digits only and be within unsigned uint64 range `0..18446744073709551615`. Canonical value is base-10 without redundant leading zeroes (`0007` becomes `7`).
- **Hash:** surrounding UI whitespace is ignored. A selected hash memo must contain exactly 64 hexadecimal characters (32 bytes). Canonical value is lowercase hexadecimal.

Selecting ID or Hash with an empty/invalid value is an explicit validation error; it must not silently become “no memo”.

SEP-29 `config.memo_required` is satisfied by any valid Text, ID, or Hash memo. It is not satisfied by no memo.

## Stellar build and inspection

Outbound build maps the canonical typed memo to the canonical Stellar SDK constructor: `Memo.text`, `Memo.id`, or `Memo.hash`.

Exact-XDR inspection must accept and project none, text, ID, and hash. It must continue to reject `MEMO_RETURN` and any unknown memo kind for this Send contract. Hash inspection projects lowercase hex; ID inspection projects canonical decimal.

## Review, duplicate intent and recovery

Payment review displays memo type and canonical value from exact XDR. Mutable form memo fields are never used as the signing/recovery authority.

Pending-submission economic intent identity must include both memo type and canonical value. `none`, `text`, `id`, and `hash` must never collide. Existing Stage 2.5 submission/reconciliation state transitions are otherwise unchanged.

A build/inspect mismatch in memo type or value fails closed before signing.

## Product UI

Send Form exposes an explicit memo type choice: None, Text, ID, Hash. Only the chosen non-None input is editable. Changing memo type clears the previous memo value so a value cannot be reinterpreted under another memo family.

Review identifies the memo family as well as its canonical value. New memo-family labels, hints, and validation messages enter the locale dictionaries; this slice does not rewrite unrelated existing Send copy.

Controls added by this slice must have explicit accessibility roles/labels. Full Send dynamic-font and screen-reader focus-order acceptance remains part of aggregate/L4 acceptance, not a reason to expand this memo slice.

## Required acceptance

Unit/contract coverage must prove text whitespace/UTF-8 limits, ID canonicalization/bounds, hash canonicalization/length, SEP-29 memo-required acceptance, exact-XDR round-trip for all three supported memo families, `MEMO_RETURN` fail-closed behavior, typed duplicate-intent separation, and unchanged muxed-address rejection.
