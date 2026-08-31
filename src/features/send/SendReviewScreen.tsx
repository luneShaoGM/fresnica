import React from 'react';

import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';

export function SendReviewScreen() {
  return (
    <Screen eyebrow="Send" title="Review payment">
      <Card
        title="Exact transaction review"
        description="This screen will render only from the immutable PaymentReview derived from the exact built XDR. It must not reconstruct amount, destination, asset, memo or fee from mutable form state."
      />
      <Card
        title="Authorization"
        description="Confirmation continues through current ledger authorization and shared Signing Coordination. This structure screen does not implement its own biometric/passphrase branch."
      />
    </Screen>
  );
}
