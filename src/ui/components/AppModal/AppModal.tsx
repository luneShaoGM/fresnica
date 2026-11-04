import React from 'react';
import { Modal, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemedStyles } from '@ui/theme';

import { createStyles } from './styles';

export type AppModalProps = React.PropsWithChildren<
  Readonly<{
    visible: boolean;
    presentation?: 'dialog' | 'sheet';
    onRequestClose: () => void;
    title?: string;
    description?: string;
    dialogStyle?: StyleProp<ViewStyle>;
  }>
>;

export function AppModal({
  visible,
  onRequestClose,
  title,
  description,
  dialogStyle,
  children,
  presentation = 'dialog',
}: AppModalProps) {
  const styles = useThemedStyles(createStyles);

  const Container = presentation === 'sheet' ? SafeAreaView : View;
  const containerProps = presentation === 'sheet' ? { edges: ['bottom'] as const } : {};
  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent transparent visible={visible}>
      <View style={[styles.overlay, presentation === 'sheet' ? styles.sheetOverlay : undefined]}>
        <Pressable accessibilityLabel="Close dialog" onPress={onRequestClose} style={styles.backdrop} />
        <Container
          {...containerProps}
          accessibilityViewIsModal
          style={[styles.dialog, presentation === 'sheet' ? styles.sheet : dialogStyle]}
        >
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {children}
        </Container>
      </View>
    </Modal>
  );
}
