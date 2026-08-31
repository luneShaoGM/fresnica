import React from 'react';
import {Text} from 'react-native';

import {APP_CONFIG} from '../../app/config/appConfig';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, typography} from '../../ui/theme';

export function AboutScreen() {
  return (
    <Screen eyebrow="Settings" title="About">
      <Card title={APP_CONFIG.appName} description="Stellar wallet powered by the Fresnica Native SDK security boundary.">
        <Text style={{...typography.caption, color: palette.text}}>
          Project: {APP_CONFIG.projectName}
        </Text>
        <Text style={{...typography.caption, color: palette.textMuted}}>
          Current product network: Stellar Testnet
        </Text>
      </Card>
      <Card
        title="Compatibility"
        description="Native SDK and adapter compatibility remains enforced at the platform boundary. Detailed diagnostics belong in developer/support tooling rather than ordinary wallet state."
      />
    </Screen>
  );
}
