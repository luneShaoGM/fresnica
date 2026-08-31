import React from 'react';

import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';

type Props = Readonly<{
  operationId: string;
}>;

export function OperationDetailsScreen({operationId}: Props) {
  return (
    <Screen eyebrow="Activity" title="Operation details">
      <Card
        title={operationId}
        description="Operation detail presentation will be populated from Horizon history data. No transaction or signer material is carried in navigation parameters."
      />
    </Screen>
  );
}
