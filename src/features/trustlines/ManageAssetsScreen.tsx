import React from 'react';

import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';

type Props = Readonly<{
  accountLabel?: string;
}>;

export function ManageAssetsScreen({accountLabel}: Props) {
  return (
    <Screen eyebrow="Wallet" title="Manage assets">
      <Card
        title={accountLabel ? `Assets for ${accountLabel}` : 'Assets'}
        description="Trustline discovery, review and transaction construction are not connected yet. Fresnica will not present asset changes as available until the trustline transaction capability uses the shared review, authorization and signing pipeline."
      />
    </Screen>
  );
}
