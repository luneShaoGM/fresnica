# S05 Testnet Friendbot behavior specification

Trace ID: `S05` — Home balances/availability/refresh/inactive/Friendbot.

Stage: Stage 4 Home closure increment.

Provenance: clean-room behavior rewrite. Product role is recorded in `docs/stellar-product-information-architecture.md`; donor source, tests, comments, component structure and resources are not implementation templates.

## User-visible behavior

- An inactive Classic account on `stellar-testnet` exposes a **Fund with Friendbot** action in Home.
- The action is available for software-signer and watch-only accounts because Friendbot needs only the public account address.
- Mainnet, unknown networks, active accounts and non-Classic identities never expose the action.
- While funding is in progress, duplicate funding requests are disabled.
- A successful Friendbot request does not create or edit a local balance. Home immediately reloads the account through the existing authoritative Balance/Horizon path.
- A failed Friendbot request leaves the account in the inactive state, shows stable localized retry copy and allows another attempt.
- Switching accounts while a request is in flight must not let the stale result overwrite or refresh the newly selected account.
## Protocol and security invariants

- The current Testnet mechanism is Stellar Friendbot at `https://friendbot.stellar.org` with the public Classic address in the `addr` query parameter.
- Only the public `G...` address may leave the app for this request. Secret, mnemonic, app passphrase, signer material, XDR and account labels are never sent.
- Network eligibility is owned by the Network capability; the HTTP adapter does not redefine product policy.
- Non-success HTTP responses are failures. Response bodies are not rendered as trusted product copy.
- Friendbot is not a transaction-submission path and does not enter the reviewed transaction/recovery pipeline.

## Acceptance cases

1. Testnet + inactive Classic account: action is offered and one funding request uses the exact public address.
2. Funding success: Home reloads balances from Horizon and becomes active only when Horizon reports the account.
3. Funding failure: no local balance is fabricated; localized error remains retryable.
4. Mainnet/unknown network: capability fails closed even if called programmatically, and Home does not offer the action.
5. Contract account: capability fails closed and Home does not offer the action.
6. Duplicate taps while funding do not create parallel requests.
7. An account switch invalidates the in-flight UI result so it cannot replace the new account's Home state.
8. Architecture/provenance/locale gates and targeted unit tests pass before native acceptance.
