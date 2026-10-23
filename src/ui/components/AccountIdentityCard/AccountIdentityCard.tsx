import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useThemedStyles } from '@ui/theme';
import { formatPublicAddress } from '../../formatPublicAddress';

import { createStyles } from './styles';

export type AccountIdentityCardVariant = 'default' | 'compact' | 'selectable';

export type AccountIdentityCardProps = Readonly<{
  address: string;
  name: string;
  secondaryText?: string;
  memoLabel?: string;
  memoValue?: string;
  sourceLabel?: string;
  loading?: boolean;
  selected?: boolean;
  variant?: AccountIdentityCardVariant;
  showAvatar?: boolean;
  showAddress?: boolean;
  showMemo?: boolean;
  showMenu?: boolean;
  showSource?: boolean;
  fullAddress?: boolean;
  menuAccessibilityLabel?: string;
  onPress?: () => void;
  onMenuPress?: () => void;
}>;

export function AccountIdentityCard({
  address,
  name,
  secondaryText,
  memoLabel,
  memoValue,
  sourceLabel,
  loading = false,
  selected = false,
  variant = 'default',
  showAvatar = true,
  showAddress = true,
  showMemo = true,
  showMenu = false,
  showSource = false,
  fullAddress = false,
  menuAccessibilityLabel = 'Account actions',
  onPress,
  onMenuPress,
}: AccountIdentityCardProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const compact = variant === 'compact';
  const displayedAddress = fullAddress && !compact ? address : formatPublicAddress(address);
  const initial = name.trim().slice(0, 1) || address.slice(0, 1);

  const content = (
    <>
      {showAvatar ? (
        <View style={[styles.avatar, compact ? styles.avatarCompact : undefined]}>
          <Text style={styles.avatarText}>{initial.toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text ellipsizeMode="middle" numberOfLines={1} style={styles.name}>
            {loading ? '…' : name}
          </Text>
          {loading ? <ActivityIndicator /> : null}
          {showSource && sourceLabel ? <Text style={styles.source}>{sourceLabel}</Text> : null}
        </View>
        {secondaryText ? (
          <Text numberOfLines={1} style={styles.address}>
            {secondaryText}
          </Text>
        ) : showAddress ? (
          <Text numberOfLines={compact ? 1 : 2} selectable={!compact} style={styles.address}>
            {displayedAddress}
          </Text>
        ) : null}
        {showMemo && !compact && memoValue ? (
          <Text style={styles.memo}>
            {memoLabel ? `${memoLabel}: ` : ''}
            {memoValue}
          </Text>
        ) : null}
      </View>
      {showMenu ? (
        <Pressable
          accessibilityLabel={menuAccessibilityLabel}
          accessibilityRole="button"
          onPress={onMenuPress}
          style={styles.menu}
        >
          <Text style={styles.menuText}>⋯</Text>
        </Pressable>
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    compact ? styles.compact : undefined,
    variant === 'selectable' ? styles.selectable : undefined,
    selected ? styles.selected : undefined,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [...rowStyle, pressed ? styles.pressed : undefined]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{content}</View>;
}
