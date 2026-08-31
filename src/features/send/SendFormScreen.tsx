import React from 'react';

import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';

type Props = Readonly<{
  accountLabel?: string;
}>;

export function SendFormScreen({accountLabel}: Props) {
  return (
    <Screen eyebrow="Send" title="New payment">
      <Card
        title={accountLabel ? `From ${accountLabel}` : 'Choose payment details'}
        description="Recipient, asset, amount and memo entry belongs here. The product form is not wired in this structure milestone; transaction construction must continue through the existing Stellar Gateway and Payment capability."
      />
    </Screen>
  );
}
