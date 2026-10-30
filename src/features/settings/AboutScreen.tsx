import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { useThemedStyles } from '../../ui/theme';

import { createStyles } from './AboutScreen.styles';
import { useLocalization } from '../../locale';

type Props = Readonly<{
  onBack: () => void;
  appName: string;
  projectName: string;
  isMainnet: boolean;
}>;

export function AboutScreen({ onBack, appName, projectName, isMainnet }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton label="Back" onPress={onBack} size="sm" variant="quiet" />
        </View>
        <Text style={styles.title}>About</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.appName}>{appName}</Text>
          <Text style={styles.tagline}>Stellar wallet powered by the Fresnica Native SDK security boundary.</Text>
        </View>

        <View style={styles.rows}>
          <InfoRow label="Project" value={projectName} />
          <InfoRow
            label="Network"
            value={t(isMainnet ? 'networkManage.name.stellar-mainnet' : 'networkManage.name.stellar-testnet')}
          />
          <InfoRow label="Runtime" value="React Native 0.87" />
          <InfoRow label="Security" value="Fresnica Native SDK" />
        </View>

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Compatibility</Text>
          <Text style={styles.noteText}>
            Native SDK and adapter compatibility is enforced at the platform boundary. Detailed diagnostics remain
            developer/support tooling rather than wallet state.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}
