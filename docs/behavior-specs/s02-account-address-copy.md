# S02 Account address copy

Existing S02 maintenance; Phase 0 foundations reused, aggregate maturity unchanged. Account feature owns presentation, app composition injects the existing platform copyPublicText port. Adapt / clean-room from the user request and existing Fresnica components; no donor implementation consulted. No new architecture scope or Capability semantics.

- Settings → Accounts exposes Copy address separately from the open-details card for every listed account, including hidden and watch-only accounts.
- Account details exposes the same action next to the complete address.
- Only an explicit tap writes the exact AccountRecord.address (including a muxed identity) through the existing clipboard service. Never copy the label, shortened display text, secret or recovery phrase.
- Pending writes disable the button. Completion shows localized accessible feedback. Failure shows a generic message and permits retry, without rendering native error contents.
- Navigation, reorder, rename, hide/delete and account/network selection retain their existing behavior.

Automated component tests are helper evidence; native clipboard, narrow-screen, large-text and VoiceOver/TalkBack acceptance remain pending. This slice does not add post-onboarding recovery-phrase viewing. That requires a separate fresh App Passphrase and SDK/Core security lifecycle slice.
