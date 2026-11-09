import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppModal } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { createStyles } from '../styles';

export type HomeAssetCategory = 'tokens' | 'claimable';

type Props = Readonly<{
  visible: boolean;
  current: HomeAssetCategory;
  showClaimable: boolean;
  onClose: () => void;
  onSelect: (category: HomeAssetCategory) => void;
}>;

export function AssetCategoryDialog({ visible, current, showClaimable, onClose, onSelect }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const categories: HomeAssetCategory[] = showClaimable ? ['tokens', 'claimable'] : ['tokens'];
  return (
    <AppModal visible={visible} onRequestClose={onClose}>
      <View style={styles.categoryDialogHeading}>
        <Text style={styles.sectionTitle}>{t('claimable.category.choose')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          style={styles.categoryDialogClose}
        >
          <Text style={styles.sectionLink}>{t('common.close')}</Text>
        </Pressable>
      </View>
      {categories.map(category => (
        <Pressable
          key={category}
          accessibilityRole="radio"
          accessibilityLabel={t(category === 'tokens' ? 'claimable.category.assets' : 'claimable.category.claimable')}
          accessibilityState={{ selected: current === category }}
          onPress={() => onSelect(category)}
          style={[styles.categoryOption, current === category ? styles.categoryOptionSelected : undefined]}
        >
          <Text style={styles.categoryOptionText}>
            {t(category === 'tokens' ? 'claimable.category.assets' : 'claimable.category.claimable')}
          </Text>
        </Pressable>
      ))}
    </AppModal>
  );
}
