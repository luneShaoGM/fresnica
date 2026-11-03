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
- Identity is network + exact G address + canonical memo type/value. Same address with different memos
  is allowed; duplicate exact identities are rejected atomically, including during editing.
- Persisted Memo JSON is untrusted input: validate its runtime discriminant, string value and
  canonical typed-Memo rules before exposing a Contact. Invalid present data fails with a stable
  storage error and is never reinterpreted as absent Memo or erased automatically. Filter the
  requested network before decoding; corrupt foreign-network records cannot block healthy-network
  reads/writes. Corruption in the requested network fails closed and preserves records for recovery.
- Contacts are local public metadata shared by wallet accounts within a network. Network changes
  remount the service session; no other network's contacts are shown or selected. Account deletion
  does not delete contacts. No old Stellar/Xaman database migration or remote sync.
- Writes/removals are durable atomic Realm transactions; failure leaves the editor open with retry.
  Additive v8 to v9 migration preserves accounts/signers, grants, caches and preferences.
- Delete requires explicit confirmation. Share uses current-network SEP-7 when memo exists.
- Send destination picker searches saved contacts and visible Classic accounts on the active network.
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

Automated: duplicate canonical memo identity, validation bounds, network isolation, edit/remove,
write failure, v8 migration and reopen durability, picker atomic prefill, participant action routing.
Native: Android/iOS list/editor/picker, keyboard/back, delete cancel/retry, Activity return refresh,
share sheet cancellation, accessibility and narrow-screen layout deferred to final device acceptance.
S22 is not L3/L4 solely because tests/CI pass. Independent exact-HEAD implementation review required.
