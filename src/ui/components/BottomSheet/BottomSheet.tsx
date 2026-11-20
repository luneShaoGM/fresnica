import React from 'react';
import { View } from 'react-native';

import { useThemedStyles } from '@ui/theme';

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

  return (
    <AppModal
      animationType="slide"
      closeLabel={closeLabel}
      dragDismissLabel="Drag down to close"
      onRequestClose={onClose}
      presentation="sheet"
      swipeToDismiss
      visible={visible}
    >
      <View style={styles.panel}>{children}</View>
    </AppModal>
  );
}
