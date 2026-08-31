import React from 'react';

import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';

type Props = Readonly<{
  outcome?: 'accepted' | 'rejected' | 'uncertain';
}>;

export function SendResultScreen({outcome}: Props) {
  return (
    <Screen eyebrow="Send" title="Payment result">
      <Card
        title={outcome ? `Submission ${outcome}` : 'Submission result'}
        description="The final product state will be driven by the normalized transaction submission result. An uncertain submission must remain distinct from a rejection and must not be presented as success."
      />
    </Screen>
  );
}
