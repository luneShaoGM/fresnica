import React from 'react';
import { Pressable, Text, View } from 'react-native';
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
  avatar,
  memoText,
  onPress,
}: Readonly<{
  address: string;
  name: string;
  label: string;
  presentation?: 'card' | 'compact' | 'selectable';
  secondary?: string;
  avatar?: React.ReactNode;
  memoText?: string;
  onPress?: () => void;
}>) {
  const styles = useThemedStyles(createStyles);
  if (presentation === 'compact') {
    return (
      <View style={styles.compact}>
        {avatar ?? <IdentityAvatar identity={address} />}
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
  if (presentation === 'selectable') {
    const content = (
      <>
        <IdentityAvatar identity={address} />
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.name}>
            {name.trim() || formatPublicAddress(address)}
          </Text>
          {secondary ? (
            <Text numberOfLines={1} style={styles.label}>
              {secondary}
            </Text>
          ) : null}
          <Text selectable accessibilityLabel={address} numberOfLines={2} style={styles.address}>
            {address}
          </Text>
          {memoText ? (
            <Text numberOfLines={2} style={styles.label}>
              {memoText}
            </Text>
          ) : null}
        </View>
      </>
    );
    if (onPress) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[name.trim() || address, address, memoText].filter(Boolean).join(', ')}
          onPress={onPress}
          style={({ pressed }) => [styles.selectable, pressed ? styles.pressed : undefined]}
        >
          {content}
        </Pressable>
      );
    }
    return <View style={styles.selectable}>{content}</View>;
  }
  return (
    <View style={styles.card}>
      <IdentityAvatar identity={address} />
      <View style={styles.identity}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.name}>{name.trim() || address}</Text>
        {secondary ? <Text style={styles.label}>{secondary}</Text> : null}
        <Text accessibilityLabel={address} selectable style={styles.address}>
          {formatPublicAddress(address)}
        </Text>
      </View>
    </View>
  );
}
