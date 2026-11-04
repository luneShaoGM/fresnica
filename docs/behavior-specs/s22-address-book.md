# S22 Address Book and participant identity

Status: implementation candidate; no native acceptance claimed. Adapt, clean-room.
Foundation phases 0/2a/2b and shared transaction recovery are available; theme 2c remains partial.
Owner: features/contacts + capabilities/contacts; persistence mechanism: platform/persistence.

## Behavioral reference and scope

Stellar references: Settings/AddressBook list/add/edit, Modal/DestinationPicker,
Overlay/ParticipantMenu, Modules/AccountIdentityCard and Send result/recipient roles.
Only behavior is retained; no donor implementation/resources are migrated.

- Settings opens a searchable contact list ordered by name. Empty state offers Add.
- Add/edit require a nonblank name (max 30), a valid Classic G address and optional typed memo.
  Support current Fresnica text/id/hash semantics; reuse existing validators. Unsupported M addresses,
  legacy tags, federation/resolver results and memo return are not silently converted.
- Identity is globally shared across Stellar networks: exact G address + canonical memo type/value.
  Same address with different memos is allowed; new duplicate exact identities are rejected atomically,
  including during editing. Network is a transaction/account boundary, not contact visibility or uniqueness.
- Persisted Memo JSON is untrusted input: validate its runtime discriminant, string value and
  canonical typed-Memo rules before exposing a Contact. Invalid present data fails with a stable
  storage error and is never reinterpreted as absent Memo or erased automatically. Filter the
  entire global address book before exposing contacts. Corruption in any existing contact fails closed
  for the global list and writes; preserve the record for explicit recovery instead of silently deleting it.
- Contacts are local public metadata shared across Stellar networks and all wallet accounts. Network
  changes remount service sessions but do not change contact visibility. Account deletion never deletes
  contacts. The v9 networkId field is retained only as historical creation provenance; existing rows
  remain on disk without lossy rewrites. Legacy duplicates created on different networks are shown as
  separate records for user resolution, not silently merged or deleted. Ambiguous exact-match identity
  labels fail closed rather than choosing one record arbitrarily. Explicit Edit/Delete by record ID
  remains available, while any new duplicate save is rejected. No old Stellar/Xaman database import
  or remote sync.
- Writes/removals are durable atomic Realm transactions; failure leaves the editor open with retry.
  Additive v8 to v9 migration preserves accounts/signers, grants, caches and preferences.
- Delete requires explicit confirmation. Share uses current-network SEP-7 when memo exists.
- Each delete confirmation has a distinct interaction generation. Keep, close and a new confirmation
  retire earlier callbacks: a queued Confirm/Keep from confirmation A cannot delete a contact or
  cancel confirmation B. A current failed removal remains retryable and successful removal is one-shot.
- Send destination picker searches globally saved contacts and visible Classic accounts on the active network.
  Choosing a contact applies its address and typed memo together to the editable form, clearing any
  previous memo when the selected contact has none. Existing review/authorization/submission remain
  authoritative. Manual input never guesses a saved memo. Review retains full address/memo.
- Activity operation details render account participants as identity cards. Card/menu includes full
  public address, local exact-match contact name if known, Copy/Share and Add (or Edit) contact.
  Do not treat local name as verified identity. Activity history has no authoritative transaction memo;
  never infer a memo from another contact or attach transaction-wide memo to arbitrary participants.
  Contract/pool/nonaccount identities remain plain values, without Add.
- Send form/review/result can reuse participant identity presentation without changing transaction
  result semantics; only a deterministically submitted result offers Add contact.
- Closing sheets/editors does not save; no timer-based navigation or delayed callbacks restore them.

## Validation and deferred acceptance

Automated: duplicate canonical memo identity across networks, validation bounds, legacy record
preservation and conflict handling, edit/remove, write failure, v8 migration and reopen durability,
picker atomic prefill, participant action routing.
Native: Android/iOS list/editor/picker, keyboard/back, delete cancel/retry, Activity return refresh,
share sheet cancellation, accessibility and narrow-screen layout deferred to final device acceptance.
S22 is not L3/L4 solely because tests/CI pass. Independent exact-HEAD implementation review required.

## Candidate integration and data lifecycle (2026-11-02)

- Storage/migration baseline: local `fbc02eb1d5f9a33d8288b16c075a692d7150c2ec`, based on
  `main@0eafeffd0ed13b9c201a4f13165be4d173432a96`. UI is a separate dependent slice;
  no independent Work approval or merge is asserted here.
- Settings owns `address-book` navigation; one shared feature editor is reused from participant menus.
  The existing AccountIdentityCard supplies the presentation, while wallet/contact policy stays in features/capabilities.
  The pending shared ConfirmDialog PR is not a dependency; contact deletion uses an explicit local confirmation.
- Activity source/counterparty/issuer and participant identities become cards only when the exact identity
  validates as a Classic G account. M-addresses are not flattened to base accounts; other values remain selectable text.
- Send form opens the contact/visible-wallet-account picker. Review retains exact full destination and memo;
  local labels do not replace those authoritative values. Submitted-result contact metadata comes from that review,
  never from a newly edited form. Uncertain/rejected/blocked outcomes have no result Add affordance.
- Contacts are user-authored local records, not a remote ledger cache. There is no TTL or automatic eviction:
  records survive offline/restart until explicit user deletion. Save/remove synchronously invalidate subscribers;
  switching network retires old write authority and remounts the network session. Account deletion preserves contacts.
- No remote contact lookup, contact upload or automatic share occurs. Explicit Share reuses the existing OS output
  port and SEP-7 encoder; contact names are not sent. A cancelled OS share is not described as delivery success.
  Public addresses, names and memos use ordinary local Realm metadata; wallet secrets are never stored here.
- Repeated label/identity roles in Activity keep their existing data fields; this slice does not change Horizon
  operation projection, fetch behavior, transaction memo authority, authorization, signing or recovery.
- Native final acceptance includes long names/addresses, keyboard, Android back, iOS swipe/back, screen readers,
  share cancellation, network switch and participant-menu return refresh. Automated JSX/helper checks are not
  native-flow or pixel-parity evidence.

## Developer validation (candidate tree, 2026-11-02)

- `npm run check`: 187 suites / 1519 tests; TypeScript, formatting/lint, module aliases,
  strict architecture, donor-collision provenance, locale and WebView-patch checks passed.
- `npm run test:realm`: 10 integration suites / 79 tests passed, including v8→v9 contacts upgrade,
  duplicate rollback, network isolation and reopen durability. These are real Node Realm tests.
- Android and iOS production-mode JS bundles succeeded with a temporary Metro config that watches
  the shared worktree dependency directory. The repository build config was unchanged. The React Native
  private feature-flag export warning uses the dependency's existing file-resolution fallback.
- No native build, simulator/emulator, real device, OS share flow, keyboard/back or screen-reader
  acceptance was executed for this candidate. Work must independently review the final remote HEAD.

## Global contacts alignment slice (2026-11-03; pending review)

- New policy supersedes earlier network-partition wording in the 2026-11-02 candidate notes above.
- Reuse the existing v9 Realm schema. No schema version increase or destructive migration is needed:
  the persisted networkId remains as historical origin metadata, and list/duplicate checks now span
  all stored contacts. Editing from another network preserves original network provenance.
- A pre-existing exact duplicate from another network stays visible for explicit manual resolution.
  New duplicates cannot be written. Runtime name lookup refuses ambiguous exact matches; Activity
  does not pick an arbitrary one. Malformed legacy rows are retained and fail global reads/writes
  closed, rather than being silently removed.
- Existing wallet account, history, pending submission, grant, signer and ledger network partitions
  remain unchanged. Global contacts never switch transaction network or alter exact-XDR validation.
- The agreed next slices extend contacts to M addresses/Memo Return and update the Send transaction
  validation pipeline before M recipients are selectable for sending; public identity cards, avatar
  candidates, SectionList, scanning, name resolution and Stellar Send step order are separately queued.
- Validation below must distinguish automated tests from deferred native product-flow acceptance.


## Stellar contact directory UI slice (2026-11-03; pending review)

- **Product trace:** S22 (Stage 8), Phase 2a/2b foundations available, 2c partial.
  Stellar reference: Settings/AddressBook SectionList and shared identity card selectable presentation.
  Owner: features/contacts plus ui/components, injected platform camera/permission ports.
  Decision: **Adapt** UI behavior with independent Fresnica implementation; clean-room.
- Group contacts by the uppercase initial of their visible name, sorted by localized name and stable
  record ID within sections. Do **not** discard legitimate legacy duplicate identities using a
  `uniqBy(address, memo)` pattern; each pre-existing record must remain available for explicit
  user cleanup. Non-Latin initial characters retain their own headings.
- Reuse and extend the existing `AccountIdentityCard` with a selectable presentation, public
  address, optional Memo and the same local deterministic `IdentityAvatar` fallback already
  used by compact cards. Keep unverified local names distinct from authoritative address values.
  No third-party avatar or image proxy network calls are introduced, avoiding unapproved
  address disclosure. Trusted asset/issuer avatar candidate parity is deferred.
- The Settings Address Book Add/Edit editor has an opt-in QR scanner reusing the existing
  platform camera view and permission port. The feature screen never imports native camera,
  Realm or SDK adapters. Scanned raw G addresses and valid same-network SEP-7 payment requests
  populate address and optional Memo, while payment amount/asset/message are *not* saved in
  contacts. Invalid, unsupported, cross-network and sensitive input fails closed.
- Starting a scan does not save or submit anything. Closing, canceling or losing focus retires
  pending permission requests and camera frame callbacks, including callbacks from previous
  scanner sessions. Permission denied/blocked, camera error and invalid QR have retry/cancel
  paths. Editing/deleting still requires explicit user action.
- This slice wires scanning in Settings Address Book only. The Activity participant menu editor,
  Send picker, remote avatar/asset icon resolution and M-address support are still deferred
  (M destinations cannot yet pass the existing payment validation pipeline). Do not silently
  treat the lack of native camera product-flow acceptance as approval.

## Local identity display resolver + Send picker slice (2026-11-03; review together with #156)

- **Product trace:** S22 Stage 8 contact UX, using the existing Contacts capability and
  AccountIdentityCard; behavior reference: Stellar ResolverService/ContactIdentity, adapted
  independently. No external Resolver backend, remote API, avatar proxy, or new persisted
  cache is introduced.
- Pure, synchronous **display-only** lookup priority:
  1. One exact saved contact by full address + normalized typed Memo.
  2. With a Memo, if no exact match exists, one address-only saved contact as a **name only**
     fallback. Label the source explicitly as an address-only match.
  3. One visible Classic wallet account matching the full address on the **current
     network** (never a hidden, contract, or cross-network account).
  4. Raw public address if no unique name is available.
  Duplicate exact matches must not choose one by insertion order or fall back through
  to an unrelated plain-address contact; any wallet fallback still follows network
  boundaries. The returned display data has no transferable recipient/memo values.
- **Security separation:** Contact editing and Send selection keep strict exact identities
  and the existing re-read-by-record-ID path; displaying a plain contact's name cannot
  inject that contact's Memo into Send or switch wallet networks. No modification of
  payment preparation, memo requirements, exact XDR, signing, or recovery.
- Activity list rows have no authoritative transaction Memo in their name projection and
  therefore use **only unique address-only saved names** (or visible wallet labels).
  In particular, a memo-specific contact cannot be assigned to an unrelated activity
  participant; Activity detail continues to use explicit participant addresses only.
- Reuse the shared identity card in Send recipient picker with the original public address,
  typed Memo and visible contact/own-wallet source labels. Globally shared contacts remain
  selectable, but own wallet accounts stay scoped to the active network.
- **P2 correction for #156:** Send review/result and Activity operation details must receive
  the same complete wallet-account candidates as their picker/list, not only the currently
  selected sending/viewed account. The display resolver continues to enforce full-address,
  active-network, visible-Classic and unique-match requirements for any wallet label.
  The additional account candidates are display-only: no destination/Memo/intent/XDR or
  transaction partition is derived from them. Cross-page tests cover wallet B selected
  from wallet A, including foreign-network lookalikes and Activity list-to-detail routing.
- Validation: unit tests for exact/canonical Memo precedence, plain-address display fallback,
  legacy duplicate ambiguity, account/network isolation, Activity no-memo attribution,
  participant Add/Edit exactness, picker session re-read and source labels; full repository
  check on the final HEAD. Native product-flow acceptance remains deferred.

## Address Book cross-surface product closure (2026-11-04; combined review candidate)

- **Decision / trace:** Stage 8 S22, Phase 2c partial; clean-room **Adapt** of Stellar
  Settings/AddressBook, Activity participant and Send Details/Recipient/Summary behavior.
  The user confirmed on 2026-11-04 that **M-address delivery is paused**. Do not introduce
  M-address contact selection, muxed ID or altered CreateAccount rules here.
  Separate pending PR #159 (G-address Memo Return) is not incorporated into this PR's
  base or code; once merged, reconfirm Memo Return works in the new Recipient step.
- Reuse merged #156 global v9 Contacts, unique full G + typed Memo identity, existing
  AccountIdentityCard, IdentityAvatar and SectionedList; do not fork a new data model,
  Realm store or native camera. Legacy duplicates remain visible by stable ID,
  and ambiguous contact-name lookups continue to fail closed.
- **Send:** (1) Details / asset and nonzero payment amount with at most seven decimals;
  (2) Recipient / manual G address, global saved contact, visible current-network
  Classic wallet, opt-in camera QR and typed Memo; (3) Summary / existing authoritative
  unsigned Payment XDR review and unchanged authorization, signing, submission,
  uncertain/recovery. Returning from Summary goes to Recipient with draft intact;
  returning from Recipient goes to Details without silently replacing fields.
  Cancel is available in both input steps. Invalid Details amount never starts
  network preparation; QR/selection cannot submit autonomously.
- Saved contact/QR selection fills exact address plus its own typed Memo. Changing
  that automatically selected address manually discards the *old borrowed Memo*;
  manually edited Memo belongs to the user and is preserved. Contacts re-read by
  exact ID; no memo inferred from a local display-name fallback.
- **QR and Activity:** Send Recipient camera and Activity participant Add/Edit reuse
  injectable ContactScanner with existing camera/permission ingress. Existing
  scannedContactRecipient validates raw Classic G and same-network SEP-7 QR, copying
  only destination and Memo, never amount, asset, message or auto-saving a contact.
  Permission denial, blocked or exception never mounts a camera without fresh
  granted status. Retry rechecks OS permission, cancel and stale callbacks retire.
  Activity transaction Memo is not assigned to arbitrary counterparties.
- **External identity:** No vetted external name/brand avatar provider or address-
  disclosure policy is available in the current Fresnica Capability/Services contract.
  Do not fabricate such services or send address metadata to third parties. Reuse
  local-name resolver and offline deterministic avatar fallback, and explicitly
  defer external enrichment rather than claim it is complete.
- Validation: updated component/cross-surface tests, TypeScript and full npm run check
  on final exact HEAD; actual Android/iOS permissions, keyboard/back/large-font/reader
  product flow and real Send submission are **not** proven by Jest/CI. Stage 9
  iOS System Auth cancel/retry remains deferred.
