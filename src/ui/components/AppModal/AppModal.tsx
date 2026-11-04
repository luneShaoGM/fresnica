import React, { useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemedStyles } from '@ui/theme';

import { createStyles } from './styles';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 1.2;

export function shouldDismissSheetSwipe(distanceY: number, velocityY: number): boolean {
  return distanceY > DISMISS_DISTANCE || (distanceY > 16 && velocityY > DISMISS_VELOCITY);
}

export type AppModalProps = React.PropsWithChildren<
  Readonly<{
    visible: boolean;
    presentation?: 'dialog' | 'sheet';
    onRequestClose: () => void;
    title?: string;
    description?: string;
    swipeToDismiss?: boolean;
  }>
>;

export function AppModal({
  visible,
  onRequestClose,
  title,
  description,
  swipeToDismiss = false,
  children,
  presentation = 'dialog',
}: AppModalProps) {
  const styles = useThemedStyles(createStyles);
  const offsetY = useRef(new Animated.Value(0)).current;
  const draggable = presentation === 'sheet' && swipeToDismiss;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          draggable && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => offsetY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (shouldDismissSheetSwipe(gesture.dy, gesture.vy)) {
            onRequestClose();
          } else {
            Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [draggable, offsetY, onRequestClose],
  );

  const Container = presentation === 'sheet' ? SafeAreaView : View;
  const containerProps = presentation === 'sheet' ? { edges: ['bottom'] as const } : {};
  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent transparent visible={visible}>
      <View style={[styles.overlay, presentation === 'sheet' ? styles.sheetOverlay : undefined]}>
        <Pressable accessibilityLabel="Close dialog" onPress={onRequestClose} style={styles.backdrop} />
        <Animated.View
          style={[
            styles.dialog,
            presentation === 'sheet' ? styles.sheet : undefined,
            { transform: [{ translateY: offsetY }] },
          ]}
        >
          <Container
            {...containerProps}
            accessibilityViewIsModal
            style={presentation === 'sheet' ? styles.sheetContent : styles.dialogContent}
          >
            {draggable ? (
              <View accessibilityLabel="Drag down to close" style={styles.dragTarget} {...responder.panHandlers}>
                <View style={styles.dragHandle} />
              </View>
            ) : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
            {children}
          </Container>
        </Animated.View>
      </View>
    </Modal>
  );
}
