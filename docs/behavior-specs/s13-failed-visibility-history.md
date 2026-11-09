# S13 failed history and visibility — Slice 6

Contemporaneous clean-room contract; S13Adapt, same maturity/strict scopes.
Include failed operations in both Horizon adapters. Wire transaction_successful
must be a boolean; preserve true/false and omit unknown rather than coercing.
Known false outcomes are a separate failed entry, never a payment/change/balance
event. Preserve only common fields and owned explicit associated public accounts;
no requested monetary amount or event quantity is shown as a completed transfer.
Failed detail explicitly explains transaction failure and no applied operation.
Unknown outcome does not become false. Legacy cache without status remains
readable and is not given a newly invented success/failure label.

Normalizers validate literal false and partition-bound explicit related accounts
for failed cache, freeze copies/strip unknowns. Legacy successful family cache
contracts remain intact. New base successful metadata must survive clones and
list/detail equality. Both list/detail share mapping; failure filter selects
only false, all default retains everything. Pagination still advances using raw
records/cursors, irrespective of display filters.

A reversible show/hide technical control defaults to showing all; explicit
operation types (data/options/sequence/TTL/restore/trust authorization/flags/
sponsorship scopes/revoke/inflation) form technical set. Account merge, unknown
operations and monetary histories do not become technical by heuristics. UI
filter/search affect only loaded data and do not cause extra network requests.
Reset transient visibility/filter on account/network switch. No hidden deletion.

Dust/Spam have no trustworthy automatic classification contract. This slice
must not fabricate labels using asset popularity or unknown token valuation.
Later explicit user hiding can supplement reversible controls; unknown assets
remain visible. Calendar dates retained, no Today/Yesterday policy.

Test both raw include_failed switches/strict boolean, failed each family with
no money, current/common and legacy cache equality/reopen, account/network
isolation, late/pagination/focus/offline failure recovery, loaded-set filter and
technical control, localized accessible labels. Native and real-device evidence
remain separate. ExactHEADreview+requiredCI then authorized merge.

Review correction: failed clawback explicitly associates its from holder. Cached
related accounts must start with source; source-only/unknown families allow no
peers, pair families at most one, claimable creation at most ten. Present invalid
successful metadata is rejected, while absent/undefined legacy metadata remains
readable. Neither corruption case can manufacture monetary success or a foreign
source-only history partition.

## 2026-11-09 Activity completion candidate

The current user explicitly restores Today/Yesterday and requests a compact
unified filter entry instead of three permanent actions. The newer
[s13-activity-controls-completion.md](s13-activity-controls-completion.md)
supersedes earlier absolute-only dates, default-show-all technical controls, and
inline visibility buttons. Shared S06 safety/consent and S13 History authority stay
unchanged. Native acceptance and L3 partial maturity are not promoted.
