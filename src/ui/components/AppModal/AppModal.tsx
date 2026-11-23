import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View, type ModalProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemedStyles } from '@ui/theme';

import { createStyles } from './styles';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 1.2;

export function shouldDismissSheetSwipe(distanceY: number, velocityY: number): boolean {
  return distanceY > DISMISS_DISTANCE || (distanceY > 16 && velocityY > DISMISS_VELOCITY);
}

export function shouldStartSheetSwipe(distanceY: number, distanceX: number): boolean {
  return distanceY > 8 && distanceY > Math.abs(distanceX);
}

export type AppModalProps = React.PropsWithChildren<
  Readonly<{
    visible: boolean;
    presentation?: 'dialog' | 'sheet';
    onRequestClose: () => void;
    title?: string;
    description?: string;
    swipeToDismiss?: boolean;
    animationType?: ModalProps['animationType'];
    contentSized?: boolean;
    sheetBackground?: 'surface' | 'background';
    closeLabel?: string;
    dragDismissLabel?: string;
    swipeHeader?: React.ReactNode;
  }>
>;

export function AppModal({
  visible,
  onRequestClose,
  title,
  description,
  swipeToDismiss = false,
  swipeHeader,
  children,
  presentation = 'dialog',
  animationType = 'fade',
  contentSized = false,
  sheetBackground = 'surface',
  closeLabel = 'Close dialog',
  dragDismissLabel = 'Drag down to close',
}: AppModalProps) {
  const styles = useThemedStyles(createStyles);
  const offsetY = useRef(new Animated.Value(0)).current;
  const draggable = visible && presentation === 'sheet' && swipeToDismiss;
  useEffect(() => {
    if (!draggable) {
      offsetY.stopAnimation();
      offsetY.setValue(0);
    }
  }, [draggable, offsetY]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => draggable && shouldStartSheetSwipe(gesture.dy, gesture.dx),
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
  const containerProps =
    presentation === 'sheet'
      ? { edges: contentSized ? (['right', 'bottom', 'left'] as const) : (['bottom'] as const) }
      : {};
  return (
    <Modal
      animationType={animationType}
      onRequestClose={onRequestClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={[styles.overlay, presentation === 'sheet' ? styles.sheetOverlay : undefined]}>
        <Pressable
          accessibilityLabel={closeLabel}
          accessibilityRole="button"
          onPress={onRequestClose}
          style={styles.backdrop}
        />
        <Animated.View
          style={[
            styles.dialog,
            presentation === 'sheet' ? styles.sheet : undefined,
            presentation === 'sheet' && sheetBackground === 'background' ? styles.sheetBackground : undefined,
            presentation === 'sheet' && contentSized ? styles.contentSizedSheet : undefined,
            draggable ? { transform: [{ translateY: offsetY }] } : undefined,
          ]}
        >
          <Container
            {...containerProps}
            accessibilityViewIsModal
            onAccessibilityEscape={onRequestClose}
            style={[
              presentation === 'sheet' ? styles.sheetContent : styles.dialogContent,
              presentation === 'sheet' && contentSized ? styles.contentSizedSheetContent : undefined,
            ]}
          >
            {draggable ? (
              <View {...responder.panHandlers}>
                <View accessibilityLabel={dragDismissLabel} style={styles.dragTarget}>
                  <View style={styles.dragHandle} />
                </View>
                {swipeHeader}
              </View>
            ) : presentation === 'sheet' ? (
              swipeHeader
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
