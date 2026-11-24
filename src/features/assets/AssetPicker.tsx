import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../../ui/components';
import { NativeButton } from '../../ui/components/NativeButton';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';
import { TokenAssetIcon } from './TokenAssetIcon';
import { assetSelectionKey, matchesAssetSearch, sendAssetAvailability } from './assetSelection';
import { createAssetPickerStyles } from './assetPickerStyles';

export function AssetPicker({
  balances,
  selectedAsset,
  disabled = false,
  onSelect,
  label,
  purpose,
}: Readonly<{
  balances: readonly BalanceLine[];
  selectedAsset: BalanceAsset;
  disabled?: boolean;
  onSelect: (asset: BalanceAsset) => void;
  label: string;
  purpose?: 'send';
}>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const styles = useThemedStyles(createAssetPickerStyles);
  const theme = useAppTheme();
  const { t } = useLocalization();
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setQuery('');
    }
  }, [disabled]);
  const selected = balances.find(line => assetSelectionKey(line.asset) === assetSelectionKey(selectedAsset));
  const content = (asset: BalanceAsset, balance: string, line?: BalanceLine) => {
    const availability = purpose === 'send' && asset.kind === 'credit' ? sendAssetAvailability(line) : undefined;
    return (
      <>
        <TokenAssetIcon asset={asset} />
        <View style={styles.body}>
          <Text style={styles.code}>{asset.code}</Text>
          <Text style={styles.detail}>{asset.kind === 'credit' ? asset.issuer : t('assets.picker.native')}</Text>
          <Text style={styles.detail}>
            {t('assets.picker.balance')}: {balance}
          </Text>
          {availability ? (
            <Text style={styles.detail}>
              {t('assets.availability.available')}: {availability.available ?? t('assets.availability.unknown')}
            </Text>
          ) : null}
          {availability?.blockedReason ? (
            <Text style={styles.detail}>{t(`assets.availability.send.${availability.blockedReason}`)}</Text>
          ) : null}
        </View>
      </>
    );
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedAsset.code}, ${selectedAsset.kind === 'credit' ? selectedAsset.issuer : t('assets.picker.native')}, ${t('assets.picker.balance')}: ${selected?.balance ?? '—'}`}
        accessibilityState={{ disabled: disabled || balances.length < 2, expanded: open && !disabled }}
        disabled={disabled || balances.length < 2}
        onPress={() => setOpen(true)}
        style={styles.row}
      >
        {content(selectedAsset, selected?.balance ?? '—', selected)}
        {balances.length > 1 ? <Text style={styles.indicator}>⌄</Text> : null}
      </Pressable>
      <BottomSheet visible={open && !disabled} onClose={close} closeLabel={t('common.cancel')}>
        <KeyboardAvoidingView style={styles.sheet} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <NativeButton label={t('common.cancel')} variant="quiet" size="sm" onPress={close} />
          </View>
          <TextInput
            accessibilityLabel={t('assets.picker.search')}
            placeholder={t('assets.picker.search')}
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          {query ? (
            <NativeButton label={t('assets.picker.clear')} variant="quiet" size="sm" onPress={() => setQuery('')} />
          ) : null}
          <FlatList
            data={balances.filter(line => matchesAssetSearch(line.asset, query))}
            keyExtractor={line => assetSelectionKey(line.asset)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.detail}>{t('assets.picker.empty')}</Text>}
            renderItem={({ item }) => {
              const isSelected = assetSelectionKey(item.asset) === assetSelectionKey(selectedAsset);
              const blockedReason = purpose === 'send' ? sendAssetAvailability(item).blockedReason : undefined;
              const unavailable = disabled || blockedReason !== undefined;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: unavailable }}
                  accessibilityHint={blockedReason ? t(`assets.availability.send.${blockedReason}`) : undefined}
                  disabled={unavailable}
                  onPress={() => {
                    if (unavailable) return;
                    onSelect(item.asset);
                    close();
                  }}
                  style={[styles.row, isSelected ? styles.selected : undefined]}
                >
                  {content(item.asset, item.balance, item)}
                  <Text style={styles.indicator}>{isSelected ? '◉' : '○'}</Text>
                </Pressable>
              );
            }}
          />
        </KeyboardAvoidingView>
      </BottomSheet>
    </>
  );
}
