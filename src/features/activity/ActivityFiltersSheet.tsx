import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { BottomSheet } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import type { ActivityQuantityFilter } from './activityQuantityFilter';
import type { ActivityFilter } from './activityList';
import { createStyles } from './styles';

export type ActivityDisplayFilters = Readonly<{
  type: ActivityFilter;
  showHidden: boolean;
  hideDust: boolean;
  showFailed: boolean;
  hiddenAssets: ReadonlySet<string>;
  quantity: ActivityQuantityFilter;
}>;
const TYPES: readonly ActivityFilter[] = [
  'all',
  'payments',
  'trustlines',
  'swaps',
  'offers',
  'pools',
  'accounts',
  'other',
  'failed',
];

export function ActivityFiltersSheet({
  initial,
  assets,
  onClose,
  onApply,
  onRefresh,
  refreshDisabled = false,
}: Readonly<{
  initial: ActivityDisplayFilters;
  assets: readonly string[];
  onClose: () => void;
  onApply: (filters: ActivityDisplayFilters) => void;
  onRefresh: () => void;
  refreshDisabled?: boolean;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [draft, setDraft] = useState(initial);
  return (
    <BottomSheet visible onClose={onClose} closeLabel={t('common.close')}>
      <View style={styles.sheetHeading}>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetTextButton}>
          <Text style={styles.sheetLink}>{t('common.cancel')}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.sheetTitle}>
          {t('activity.filters.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sheetSection}>{t('activity.filters.direction')}</Text>
        <View style={styles.filterOptions}>
          {(['incoming', 'outgoing'] as const).map(direction => (
            <Pressable
              key={direction}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.quantity.direction === direction }}
              onPress={() =>
                setDraft(value => ({
                  ...value,
                  quantity: {
                    ...value.quantity,
                    direction: value.quantity.direction === direction ? undefined : direction,
                  },
                }))
              }
              style={[
                styles.filterChip,
                draft.quantity.direction === direction ? styles.filterChipSelected : undefined,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  draft.quantity.direction === direction ? styles.filterTextSelected : undefined,
                ]}
              >
                {t(`activity.filters.${direction}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sheetSection}>{t('activity.filters.type')}</Text>
        <View style={styles.filterOptions}>
          {TYPES.map(type => (
            <Pressable
              key={type}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.type === type }}
              onPress={() => setDraft(value => ({ ...value, type: value.type === type ? 'all' : type }))}
              style={[styles.filterChip, draft.type === type ? styles.filterChipSelected : undefined]}
            >
              <Text style={[styles.filterText, draft.type === type ? styles.filterTextSelected : undefined]}>
                {t(`activity.filter.${type}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sheetSection}>{t('activity.filters.asset')}</Text>
        <Text style={styles.settingHint}>{t('activity.filters.loadedAssets')}</Text>
        {assets.map(identity => {
          const [code, issuer] = identity === 'native:XLM' ? ['XLM', ''] : (JSON.parse(identity) as [string, string]);
          const selected = draft.quantity.asset === identity;
          return (
            <Pressable
              key={identity}
              accessibilityRole="radio"
              accessibilityLabel={issuer ? `${code} · ${issuer}` : code}
              accessibilityState={{ selected }}
              onPress={() =>
                setDraft(value => ({
                  ...value,
                  quantity: { ...value.quantity, asset: value.quantity.asset === identity ? undefined : identity },
                }))
              }
              style={styles.settingRow}
            >
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{code}</Text>
                {issuer ? <Text style={styles.issuer}>{issuer}</Text> : null}
              </View>
              <Text accessible={false} style={styles.sheetLink}>
                {selected ? '●' : '○'}
              </Text>
            </Pressable>
          );
        })}
        <Text style={styles.sheetSection}>{t('activity.filters.amount')}</Text>
        <View style={styles.filterOptions}>
          {(['at-most', 'at-least'] as const).map(comparison => (
            <Pressable
              key={comparison}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.quantity.comparison === comparison }}
              onPress={() =>
                setDraft(value => ({
                  ...value,
                  quantity: {
                    ...value.quantity,
                    comparison: value.quantity.comparison === comparison ? undefined : comparison,
                  },
                }))
              }
              style={[
                styles.filterChip,
                draft.quantity.comparison === comparison ? styles.filterChipSelected : undefined,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  draft.quantity.comparison === comparison ? styles.filterTextSelected : undefined,
                ]}
              >
                {t(`activity.filters.${comparison}`)}
              </Text>
            </Pressable>
          ))}
          {['10', '25', '50', '100', '250', '500', '1000'].map(amount => (
            <Pressable
              key={amount}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.quantity.amount === amount }}
              onPress={() =>
                setDraft(value => ({
                  ...value,
                  quantity: { ...value.quantity, amount: value.quantity.amount === amount ? undefined : amount },
                }))
              }
              style={[styles.filterChip, draft.quantity.amount === amount ? styles.filterChipSelected : undefined]}
            >
              <Text
                style={[styles.filterText, draft.quantity.amount === amount ? styles.filterTextSelected : undefined]}
              >
                {amount}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.settingHint}>{t('activity.filters.amountHint')}</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{t('activity.filters.hideDust')}</Text>
            <Text style={styles.settingHint}>{t('activity.filters.dustHint')}</Text>
          </View>
          <Switch
            accessibilityLabel={t('activity.filters.hideDust')}
            accessibilityHint={t('activity.filters.dustHint')}
            value={draft.hideDust}
            onValueChange={value => setDraft(current => ({ ...current, hideDust: value }))}
          />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{t('activity.visibility.showMarked')}</Text>
            <Text style={styles.settingHint}>{t('activity.filters.hiddenHint')}</Text>
          </View>
          <Switch
            accessibilityLabel={t('activity.visibility.showMarked')}
            accessibilityHint={t('activity.filters.hiddenHint')}
            value={draft.showHidden}
            onValueChange={value => setDraft(current => ({ ...current, showHidden: value }))}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={[styles.settingTitle, styles.settingCopy]}>{t('activity.filters.showFailed')}</Text>
          <Switch
            accessibilityLabel={t('activity.filters.showFailed')}
            value={draft.showFailed}
            onValueChange={value => setDraft(current => ({ ...current, showFailed: value }))}
          />
        </View>
        <Text style={styles.sheetSection}>{t('activity.visibility.manageAssets')}</Text>
        <Text style={styles.settingHint}>{t('activity.visibility.manualOnly')}</Text>
        {assets.filter(identity => identity !== 'native:XLM').length === 0 ? (
          <Text style={styles.settingHint}>{t('activity.filters.noAssets')}</Text>
        ) : null}
        {assets
          .filter(identity => identity !== 'native:XLM')
          .map(identity => {
            const [code, issuer] = JSON.parse(identity) as [string, string];
            const hidden = draft.hiddenAssets.has(identity);
            return (
              <Pressable
                key={identity}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hidden }}
                accessibilityLabel={t(hidden ? 'activity.visibility.restoreAsset' : 'activity.visibility.hideAsset', {
                  asset: `${code} · ${issuer}`,
                })}
                onPress={() =>
                  setDraft(current => {
                    const hiddenAssets = new Set(current.hiddenAssets);
                    if (hiddenAssets.has(identity)) hiddenAssets.delete(identity);
                    else hiddenAssets.add(identity);
                    return { ...current, hiddenAssets };
                  })
                }
                style={styles.settingRow}
              >
                <View style={styles.settingCopy}>
                  <Text style={styles.settingTitle}>{code}</Text>
                  <Text style={styles.issuer}>{issuer}</Text>
                </View>
                <Text accessible={false} style={styles.sheetLink}>
                  {hidden ? '☑' : '☐'}
                </Text>
              </Pressable>
            );
          })}
        <NativeButton
          label={t('activity.refresh')}
          size="sm"
          variant="secondary"
          disabled={refreshDisabled}
          onPress={onRefresh}
        />
      </ScrollView>
      <View style={styles.sheetFooter}>
        <NativeButton label={t('activity.filters.apply')} onPress={() => onApply(draft)} />
      </View>
    </BottomSheet>
  );
}
