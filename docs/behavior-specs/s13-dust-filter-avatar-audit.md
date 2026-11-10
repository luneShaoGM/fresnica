# S13 independent dust control and avatar investigation — 2026-11-10

Written before code. S13 Adapt/clean-room, L3 partial unchanged. User requests an
explicit dust filter and a fresh investigation of Stellar avatar behavior.
Base main72f764804692ccd93d787f568b63c5c52ac9cbac. Existing <=0.1XLM rule is
already implemented but hidden behind the combined Show hidden records setting.

Add a distinct Hide dust switch in the Cancel/Apply filter sheet. Default ON;
only verified successful received/self native-XLM payment or path destination
quantities >0 and <=0.1 XLM qualify (reuse exact seven-decimal integer comparison).
Issued tokens named XLM, outgoing, failure, unknown success, malformed amounts,
account funding and claim/clawback never become dust by guessing. Dust filtering
is independent of Show hidden records and Show failed transactions, explicitly
explained in the sheet. A compact removable dust-active chip on the main list
makes the default filter visible and lets the user reveal dust with one tap.
Turn it back on from the filter sheet. Cancel/back discards draft changes, Apply
commits, refresh/pagination keeps the preference; account/network/remount resets
it to default ON. Never mutate raw entries, detail/cache or raw cursor and never
request additional history pages on a filter tap. This newer independent-control
request supersedes the earlier combined dust/technical reveal semantics.

Avatars: investigate the pinned reference independently, record account versus
asset identity, candidate precedence, remote-provider address disclosure, row
subject choice, sizes and failure behavior. Do not copy donor implementation,
artwork or tests, or silently use Token image consent to transmit full wallet or
contact addresses. A research request alone does not authorize a new external
address-avatar provider. Implementation changes, if necessary, must be based on
an approved display/privacy contract; report the concrete remaining differences.

Verification: exact dust boundary/exclusions, independent switches/active chip,
draft cancel/apply, partition reset, cursor/cache/detail unaffected; relevant
Activity tests, type/lint/locale/architecture/provenance and current exact-HEAD
independent review+CI. No native product acceptance or maturity promotion implied.
