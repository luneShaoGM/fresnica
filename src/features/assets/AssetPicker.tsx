import React, { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../../ui/components';
import { NativeButton } from '../../ui/components/NativeButton';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import type { BalanceAsset, BalanceLine } from '../../capabilities/balance/types';
import { TokenAssetIcon } from './TokenAssetIcon';
import { assetSelectionKey, matchesAssetSearch } from './assetSelection';
import { createAssetPickerStyles } from './assetPickerStyles';

export function AssetPicker({
  balances,
  selectedAsset,
  disabled = false,
  onSelect,
  label,
}: Readonly<{
  balances: readonly BalanceLine[];
  selectedAsset: BalanceAsset;
  disabled?: boolean;
  onSelect: (asset: BalanceAsset) => void;
  label: string;
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
  const content = (asset: BalanceAsset, balance: string) => (
    <>
      <TokenAssetIcon asset={asset} />
      <View style={styles.body}>
        <Text style={styles.code}>{asset.code}</Text>
        <Text style={styles.detail}>{asset.kind === 'credit' ? asset.issuer : t('assets.picker.native')}</Text>
        <Text style={styles.detail}>
          {t('assets.picker.balance')}: {balance}
        </Text>
      </View>
    </>
  );
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
        {content(selectedAsset, selected?.balance ?? '—')}
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
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  disabled={disabled}
                  onPress={() => {
                    if (disabled) return;
                    onSelect(item.asset);
                    close();
                  }}
                  style={[styles.row, isSelected ? styles.selected : undefined]}
                >
                  {content(item.asset, item.balance)}
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
