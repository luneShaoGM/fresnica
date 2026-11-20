import React from 'react';
import { View } from 'react-native';

import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';

import { AppModal } from '../AppModal';
import { createStyles } from './styles';

export type BottomSheetProps = React.PropsWithChildren<
  Readonly<{
    visible: boolean;
    onClose: () => void;
    closeLabel?: string;
  }>
>;

export function BottomSheet({ visible, onClose, closeLabel = 'Close', children }: BottomSheetProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();

  return (
    <AppModal
      animationType="slide"
      closeLabel={closeLabel}
      dragDismissLabel={t('common.dragDownToClose')}
      onRequestClose={onClose}
      presentation="sheet"
      sheetBackground="background"
      swipeToDismiss
      visible={visible}
    >
      <View style={styles.panel}>{children}</View>
    </AppModal>
  );
}
