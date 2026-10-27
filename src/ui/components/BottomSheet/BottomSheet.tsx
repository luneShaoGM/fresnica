import React from 'react';
import { Modal, Pressable, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

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
        <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={styles.panel}>
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
