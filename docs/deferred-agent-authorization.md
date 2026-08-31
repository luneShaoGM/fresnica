# Deferred Agent Authorization

Agent/AI standing authorization is intentionally **not part of the first Fresnica Mobile product version**.

Mobile must not expose or wrap the current coarse Core `AgentCapability` as a product authorization model. The current Core shape constrains account/network, operation type/count, fee and expiry, but does not yet express the transaction-specific semantic authority required by the product boundary.

Mobile implementation remains deferred until Fresnica Core provides the agreed transaction-specific limits, including at minimum the applicable destination, asset, amount/value and execution bounds described by the upstream task contract.

When Core lands that contract, Mobile should follow it rather than creating a parallel JavaScript authorization format. Product UX may then present bounded standing authorization without requiring every in-policy transaction to be re-authorized individually.

Until then:

- no Agent signing product route;
- no persisted Mobile Agent capability record;
- no JavaScript-side substitute authorization model;
- no use of Agent authorization to bypass normal Signing Coordination or Application Security policy.
