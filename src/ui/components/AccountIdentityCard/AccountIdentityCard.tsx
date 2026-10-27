import React from 'react';
import { Text, View } from 'react-native';
import { useThemedStyles } from '@ui/theme';
import { formatPublicAddress } from '../../formatPublicAddress';
import { createStyles } from './styles';

export function AccountIdentityCard({
  address,
  name,
  label,
}: Readonly<{
  address: string;
  name: string;
  label: string;
}>) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.initial}>{(name.trim() || address).slice(0, 1)}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.name}>{name.trim() || address}</Text>
        <Text accessibilityLabel={address} selectable style={styles.address}>
          {formatPublicAddress(address)}
        </Text>
      </View>
    </View>
  );
}
