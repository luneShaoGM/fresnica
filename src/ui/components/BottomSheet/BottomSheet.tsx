import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { useThemedStyles } from '@ui/theme';

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
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel={closeLabel}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View accessibilityViewIsModal style={styles.panel}>
          {children}
        </View>
      </View>
    </Modal>
  );
}
