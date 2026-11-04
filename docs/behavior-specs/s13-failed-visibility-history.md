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
