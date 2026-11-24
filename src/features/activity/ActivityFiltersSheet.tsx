import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { BottomSheet, SelectField } from '@ui/components';
import { SelectableChip } from '@ui/components/SelectableChip';
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
  const [assetControlsExpanded, setAssetControlsExpanded] = useState(false);
  const assetChoices = [...new Set([...assets, ...(draft.quantity.asset ? [draft.quantity.asset] : [])])].map(
    identity => {
      const [code, issuer] = identity === 'native:XLM' ? ['XLM', ''] : (JSON.parse(identity) as [string, string]);
      return { value: identity, label: code, ...(issuer ? { description: issuer } : {}) };
    },
  );
  return (
    <BottomSheet avoidAndroidKeyboard visible onClose={onClose} closeLabel={t('common.close')}>
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
            <SelectableChip
              key={direction}
              label={t(`activity.filters.${direction}`)}
              accessibilityRole="radio"
              selected={draft.quantity.direction === direction}
              onPress={() =>
                setDraft(value => ({
                  ...value,
                  quantity: {
                    ...value.quantity,
                    direction: value.quantity.direction === direction ? undefined : direction,
                  },
                }))
              }
            />
          ))}
        </View>
        <SelectField
          label={t('activity.filters.type')}
          value={draft.type}
          options={TYPES.map(type => ({ value: type, label: t(`activity.filter.${type}`) }))}
          onValueChange={type => setDraft(value => ({ ...value, type }))}
        />
        <SelectField
          label={t('activity.filters.asset')}
          value={draft.quantity.asset ?? ''}
          options={[{ value: '', label: t('activity.filters.allAssets') }, ...assetChoices]}
          search={{ label: t('assets.picker.search'), emptyLabel: t('assets.picker.empty') }}
          onValueChange={asset =>
            setDraft(value => ({ ...value, quantity: { ...value.quantity, asset: asset || undefined } }))
          }
        />
        <Text style={styles.settingHint}>{t('activity.filters.loadedAssets')}</Text>
        <Text style={styles.sheetSection}>{t('activity.filters.amount')}</Text>
        <View style={styles.filterOptions}>
          {(['at-most', 'at-least'] as const).map(comparison => (
            <SelectableChip
              key={comparison}
              label={t(`activity.filters.${comparison}`)}
              accessibilityRole="radio"
              selected={draft.quantity.comparison === comparison}
              onPress={() =>
                setDraft(value => ({
                  ...value,
                  quantity: {
                    ...value.quantity,
                    comparison: value.quantity.comparison === comparison ? undefined : comparison,
                  },
                }))
              }
            />
          ))}
        </View>
        <SelectField
          label={t('activity.filters.amountValue')}
          value={draft.quantity.amount ?? ''}
          options={[
            { value: '', label: t('activity.filters.anyAmount') },
            ...['10', '25', '50', '100', '250', '500', '1000'].map(amount => ({ value: amount, label: amount })),
          ]}
          onValueChange={amount =>
            setDraft(value => ({ ...value, quantity: { ...value.quantity, amount: amount || undefined } }))
          }
        />
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('activity.visibility.manageAssets')}
          accessibilityState={{ expanded: assetControlsExpanded }}
          onPress={() => setAssetControlsExpanded(value => !value)}
          style={styles.settingRow}
        >
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{t('activity.visibility.manageAssets')}</Text>
            <Text style={styles.settingHint}>
              {t('activity.filters.hiddenCount', { count: String(draft.hiddenAssets.size) })}
            </Text>
          </View>
          <Text accessible={false} allowFontScaling={false} style={styles.sheetLink}>
            {assetControlsExpanded ? '⌃' : '⌄'}
          </Text>
        </Pressable>
        {assetControlsExpanded ? (
          <View style={styles.assetVisibilityPanel}>
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
                    accessibilityLabel={t(
                      hidden ? 'activity.visibility.restoreAsset' : 'activity.visibility.hideAsset',
                      {
                        asset: `${code} · ${issuer}`,
                      },
                    )}
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
          </View>
        ) : null}
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
