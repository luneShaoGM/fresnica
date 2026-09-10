# Fresnica Mobile Product Native-Flow Smoke

This harness is the Stage 3 executable carrier for product-level native evidence. It is intentionally narrower than full tap-driven UI E2E, but it runs the production Mobile composition and product flows against real native modules, Realm, Horizon, and Stellar Testnet.

## Canonical command

```sh
npm run smoke:product-flow:android
```

The canonical command performs a fresh Android debug build. For a local repeat run against the same installed APK:

```sh
bash scripts/run-product-flow-smoke.sh android
```

`npm run check` validates the harness shell syntax plus its JavaScript Prettier and ESLint gates. It does not perform network writes.

## Flow proved

A successful run must execute, in order:

1. Open a dedicated empty Realm through production `createAppServices` and prove bootstrap is `onboarding`.
2. Run generated-mnemonic onboarding through Fresnica SDK/Core and the production Account/Signer repository.
3. Observe `pending-mnemonic-backup`, confirm the backup through the production onboarding contract, and prove bootstrap becomes `ready`.
4. Render the production `AppNavigator` with the ready bootstrap so the main shell branch is active.
5. Activate the fresh test account with Friendbot as test infrastructure only.
6. Read the account through the production Balance capability and require an active native XLM balance.
7. Build and submit a 2 XLM Send through `buildSendReview -> submitSendReview` using the production exact-XDR/sign/submission/recovery path.
8. Require a submitted or eventually confirmed transaction and perform another authoritative Balance read.
## Isolation and secret handling

- The harness uses `product-flow-smoke.realm`, not the normal application Realm.
- The runner deletes that dedicated Realm before and after each run.
- Generated mnemonic, App Passphrase, protected envelope, unlock material, and transaction XDR are never written to the callback result.
- The callback contains only public execution evidence such as network ID, public source address, balances, transaction hash, and stable stage/status markers.
- The test App Passphrase is fixed test-only material and is not a production credential.
- Friendbot is not a product dependency. It exists only to activate the newly generated Testnet source account for the smoke.

## Scope boundary

This harness proves a product **native-flow carrier**, not full visual/tap automation. In particular it does not prove:

- pixel/layout correctness;
- accessibility focus order or dynamic type;
- manual keyboard/input behavior;
- System Auth prompts on physical devices;
- every Send, Trustline, Activity, or Settings branch.

Those remain per-slice Stage 4/Stage 9 acceptance evidence. A passing product-flow smoke must not by itself promote S07, S30, or Stage 3 to L4.

## Initial Android evidence — 2026-09-10

Two independent runs used a fresh dedicated Realm and different generated source accounts.

- Fresh-build run: `10000.0000000 -> 9997.9999900 XLM`, transaction `5b606a230dfd30e4a378474b1774599c433778a0344122c752db8b060e5cd1d7`, result `submitted`.
- Immediate repeat without rebuild: `10000.0000000 -> 9997.9999900 XLM`, transaction `f3a2acf2751cee4d787fed3b248c70a4ce20d7bf3833f163c9bafedacf65bd50`, result `submitted`.

The `2.0000100 XLM` delta is consistent with the 2 XLM transfer plus the 100-stroop fee. Both runs reported `onboarding -> pending-mnemonic-backup -> ready`, active Balance reads, and a successful Testnet write.