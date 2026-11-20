# S02 Account address copy

Existing S02 maintenance; Phase 0 foundations reused, aggregate maturity unchanged. Account feature owns presentation, app composition injects the existing platform copyPublicText port. Adapt / clean-room from the user request and existing Fresnica components; 2026-11-20 layout role checked against Stellar ShortAddress at bd0f4540b2496a57314e4e29bc6fcf8ff691b60f; implementation rewritten in Fresnica without donor code, icons or dependencies. Strict presentation scope now includes the account-list and copy widget; Capability semantics unchanged.

- Settings → Accounts places a small outline copy icon immediately after the address within each account card, separate from the open-details heading for every listed account, including hidden and watch-only accounts.
- Account details exposes the same inline icon beside the complete wrapping address. List addresses may ellipsize in the middle; full clipboard value remains unchanged. A 14px theme-colored icon has a 44×44 touch target and a localized button label. There is no standalone text-button row. Feedback occupies space only after an attempt.
- Only an explicit tap writes the exact AccountRecord.address (including a muxed identity) through the existing clipboard service. Never copy the label, shortened display text, secret or recovery phrase.
- Pending writes disable the button. Completion shows localized accessible feedback. Failure shows a generic message and permits retry, without rendering native error contents.
- The card heading opens details; selecting/copying the address cannot trigger that action. Reorder, rename, hide/delete and account/network selection retain their existing behavior.

Automated component tests are helper evidence; native clipboard, narrow-screen, large-text and VoiceOver/TalkBack acceptance remain pending. Post-onboarding recovery material viewing is provided by the separate S03 flow in `s03-recovery-management.md`; its fresh App Passphrase and SDK/Core lifecycle remain unchanged by address copying.
