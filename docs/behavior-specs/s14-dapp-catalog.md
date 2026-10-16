# S14 dApp catalog — first read-only product slice

Status: first-slice behavior boundary, based on `main@a9b3274fd34858c5d3bd34e3c4c6564290093d52`. Product trace ID: S14 (Stage 7), separate from S15 Recent, S16 browser, S17 permissions and S18 Freighter.

## Intent and provenance

Fresnica will preserve the dApp directory/search/category product role without copying Stellar/Xaman implementation or bundled resources. The donor `DappCatalogService` and `dapp.fchain.io/v1` are historical product references, **not** verified API contracts, sources of trust, or instructions to port donor code. This slice uses new clean-room types and views under Fresnica layers.

## First-slice contract

- The existing dApps tab hosts a **read-only** catalog view. The App injects one Catalog port into the feature; domain filtering is pure and UI does not make network calls.
- Catalog outcomes are distinct: `ready(entries)`, `unavailable` (provider not configured), rejected/exception (retryable error), and pending (loading). `ready([])` is an authentic empty catalog, not equivalent to network error or unavailable.
- The app has **no verified catalog provider configured** in this slice. Its production port returns `unavailable`; no fake entries or suggested/verified merchant claims are generated. Debug builds may show a labeled static layout sample under that unavailable state so the search field, category chips, rows and clear button can be reviewed. Those rows are local copy, are not returned by the catalog port, do not open links, and are omitted when `__DEV__` is false.
- A future provider may return public `id/title/description/category/websiteUrl` values. Search is local against title/description/category, case-insensitive and whitespace-trimmed; category filtering is an exact category match. Categories come only from delivered entries and retain first-seen order.
- Provider entries are untrusted metadata. Before a real adapter ships it must enforce HTTPS endpoints, payload size/count limits, schema validation, redirect policy, timeouts, privacy and category constraints and clearly explain catalog/operator authority. Listing does not establish verified origin, wallet permission or endorsement.
- During a pending load, a superseded response (unmount or retry) must not override the current state. Errors are retryable; `unavailable` does not suggest futile retry.
- Displayed entries are **non-interactive** until S15/S16 origin/disclaimer/browser boundaries are independently approved. Search/category do not open URLs or request wallet access.
- Recent shows an explicit disabled state. No persistence, tracking, account/network binding, permission grants, signing, dApp injection, universal links or transaction pipeline changes occur in this slice.
- States and controls must be localized in en/zh/zh-TW and usable with accessible labels and dynamic text. Never record full untrusted entry values or URLs in diagnostics.

## Acceptance and maturity

- Unit tests cover stable category extraction, title/description/category matching, empty and no-match results, original ordering and the unconfigured provider result.
- Type/architecture/provenance/locale/Jest checks must pass. Native product interactions remain separate evidence, not inferred from the build.
- This only upgrades S14 to a **partial foundation**; L3/L4 require a real documented catalog source, validated live payloads and dual-platform product acceptance. Not a browser, recommendation, verified-origin service or complete dApp feature.
