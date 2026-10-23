# S10 Path Payment Swap — Stellar-aligned product surface

Status: clean-room product behavior specification for the post-D2c presentation alignment. Product trace ID: S10 / Stage 6. Donor behavior reference is `origin/Stellar@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`; donor source, component structure, styles and resources are not implementation inputs.

## Decision and ownership

- Decision: **Adapt** the Stellar Exchange product role as a same-account Path Payment Swap.
- Fresnica feature owner: `features/swap`; application semantics remain in `capabilities/path-payment`; platform mechanisms remain in `platform/stellar`.
- This is not an SDEX order-book/offer product, a Soroban-token swap, an XRPL DEX, or a second transaction pipeline.
- S10 remains L2 partial until live Testnet and Android/iOS aggregate acceptance. A merged presentation change does not promote maturity.

## User-visible structure

The clean-room parity baseline observed from Stellar Exchange is:

- Entry selects a concrete non-native destination asset before navigation. The form starts as XLM to that asset; it never chooses an arbitrary trustline from account response order.
- The header, both asset identities and both amount fields are visible immediately. Initial work is confined to a loading state in the quote/details region; route focus establishment must not render a blank screen.
- Pay and receive are both editable. Editing pay selects strict-send; editing receive selects strict-receive. `.` and `,` are accepted as decimal separators and the canonical value uses `.` with at most seven Stellar decimal places.
- Quote work is debounced by 500 ms. There is no separate Get Quote or Requote action and no periodic quote polling.
- With no amount, the details region is empty. During a quote it shows loading. A verified route shows rate, minimum receive or maximum send, network fee, slippage, the settings action and Swap. A true no-route response is distinct from invalid input and provider/validation failure.
- Settings is reachable from successful quote details. It contains Multi-path, an integer per-mille input, `1‰` / `5‰` / `10‰`, Done, and route choices only when Multi-path is enabled and more than one candidate exists. Defaults are Multi-path on and `5‰`.
- Switching sides or selecting the same asset on the opposite side exchanges assets, resets to strict-send and clears both amounts and stale quote state.
- Asset selection is an overlay. Assets with liquidity-pool-share or obligation roles are excluded. Full code and issuer identity remains authoritative even when the compact UI shows only a code.

The Fresnica product sequence is:

1. Back + Swap title.
2. Pay card: selected asset, spendable balance, editable amount, Max and clear.
3. Direction control that exchanges the pay and receive assets and clears stale quote/review state.
4. Receive card: selected asset, held balance, editable amount and clear.
5. Quote summary: source/destination amounts, rate, minimum receive or maximum send, network fee, quote expiry.
6. Swap settings: direct-only versus intermediate paths, explicit slippage, candidate paths and selected path.
7. Risk summary followed by structured exact-XDR review.
8. Explicit authorization, submission result and original-hash recovery.

Editing the pay amount selects strict-send. Editing the receive amount selects strict-receive. The protocol names are review details, not the primary form control. Selecting the same asset on both sides exchanges the two sides rather than leaving an invalid pair.

Asset selection uses a floating overlay and never participates in the form's normal layout. Quote reads are cancellable presentation work: amount and asset controls remain editable while a quote is loading, and stale completions cannot retain a busy lock or overwrite newer input.

Swap settings follow the Stellar interaction role: the quote details expose a compact settings action which opens a centered modal. The modal contains the intermediate-path switch, integer per-mille slippage input, `1‰` / `5‰` / `10‰` presets and candidate route selection when multiple routes exist. The default is `5‰`. Fresnica caps custom input at `100‰` (10%) because the Capability's reviewed protection policy remains authoritative; the donor's wider custom range is not adopted.

When an account has fewer than two eligible assets, the page stays structurally visible and explains that another asset/trustline is required, with an Add Asset action. Network/provider failure retains any safely cached display data and exposes retry. It must not be presented as a single-asset condition or a verified no-route result.

## Fresnica authority and safety adaptations

- Quote identity includes full network, account, asset code/issuer, fixed side and ordered path.
- Quotes expire in at most 30 seconds using the existing wall and monotonic clocks. Prepared transactions use their own TimeBounds.
- Slippage remains an explicit integer 0–1000 bps policy. The UI projects integer per-mille values to match Stellar and converts them exactly to basis points; transaction arithmetic never uses JavaScript floating point.
- Any change to amount, asset, path, slippage, account, network or route focus invalidates the prepared review.
- Review keeps full issuer identities, fee, ordered path, minimum receive or maximum send and transaction expiry available before authorization.
- The exact reviewed XDR enters the existing D1/D2c authorization/sign/submit pipeline. Navigation carries only `accountId`.
- App passphrase input remains transient and one-shot. System Auth fallback requires a new deliberate slide for the same reviewed XDR.
- Uncertain broadcast preserves the original hash, blocks duplicate economic intent and offers check-only reconciliation. It never offers rebroadcast.

## Explicit exclusions

- No `ManageSellOffer` / `ManageBuyOffer`, order book, persistent offer, bid/ask spread or XRP Toolkit behavior.
- No XRPL destination tag, reserve or IOU semantics.
- No automatic route selection after the user has entered review.
- No secret, passphrase, quote, XDR or review object in navigation or ordinary persistence.

## Acceptance

- Home and Actions enter the same route and use one eligibility policy; disabled states explain why they are unavailable.
- English, Simplified Chinese and Traditional Chinese include all visible product copy without XRPL/SDEX terminology.
- Tests cover both editable amount sides, Max, clear, direction exchange, same-asset handling, direct/intermediate paths, quote expiry, review invalidation, exact-review fields, authorization single-flight and original-hash recovery.
- Android/iOS simulator evidence covers navigation, keyboard, long issuer, three locales, no-route, expiry, cancellation and recovery. Live Testnet broadcast, physical-device System Auth and hardware/external/multisig remain separate acceptance gates.
