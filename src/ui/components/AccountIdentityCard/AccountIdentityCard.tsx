import React from 'react';
import { Text, View } from 'react-native';
import { useThemedStyles } from '@ui/theme';
import { formatPublicAddress } from '../../formatPublicAddress';
import { createStyles } from './styles';
import { IdentityAvatar } from '../IdentityAvatar';

export function AccountIdentityCard({
  address,
  name,
  label,
  presentation = 'card',
  secondary,
}: Readonly<{
  address: string;
  name: string;
  label: string;
  presentation?: 'card' | 'compact';
  secondary?: string;
}>) {
  const styles = useThemedStyles(createStyles);
  if (presentation === 'compact') {
    return (
      <View style={styles.compact}>
        <IdentityAvatar identity={address} />
        <View style={[styles.identity, styles.compactIdentity]}>
          <Text numberOfLines={1} ellipsizeMode="middle" style={styles.name}>
            {name.trim() || formatPublicAddress(address)}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.label}>
            {secondary ?? label}
          </Text>
        </View>
      </View>
    );
  }
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
