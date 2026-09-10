import React from 'react';
import {Modal, Pressable, Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type AppModalProps = React.PropsWithChildren<
  Readonly<{
    visible: boolean;
    onRequestClose: () => void;
    title?: string;
    description?: string;
  }>
>;

export function AppModal({visible, onRequestClose, title, description, children}: AppModalProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Close dialog" onPress={onRequestClose} style={styles.backdrop} />
        <View accessibilityViewIsModal style={styles.dialog}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
