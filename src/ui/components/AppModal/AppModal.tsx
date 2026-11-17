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
    closeLabel?: string;
    dragDismissLabel?: string;
    swipeHeader?: React.ReactNode;
    scrollContentAtTop?: () => boolean;
  }>
>;

export function AppModal({
  visible,
  onRequestClose,
  title,
  description,
  swipeToDismiss = false,
  swipeHeader,
  scrollContentAtTop,
  children,
  presentation = 'dialog',
  animationType = 'fade',
  contentSized = false,
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
  const contentResponder = useMemo(() => {
    if (!scrollContentAtTop) return undefined;
    let gestureStartY = 0;
    const canDragContent = (dy: number, dx: number) =>
      draggable && scrollContentAtTop?.() === true && shouldStartSheetSwipe(dy, dx);
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) => canDragContent(gesture.dy, gesture.dx),
      onMoveShouldSetPanResponder: (_, gesture) => canDragContent(gesture.dy, gesture.dx),
      onPanResponderGrant: (_, gesture) => {
        // A scroll can reach the top partway through a gesture. Count only the pull beyond that point.
        gestureStartY = gesture.dy;
        offsetY.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => offsetY.setValue(Math.max(0, gesture.dy - gestureStartY)),
      onPanResponderRelease: (_, gesture) => {
        if (shouldDismissSheetSwipe(gesture.dy - gestureStartY, gesture.vy)) {
          onRequestClose();
        } else {
          Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
      },
    });
  }, [draggable, scrollContentAtTop, offsetY, onRequestClose]);

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
            {draggable && scrollContentAtTop ? (
              <View style={styles.sheetSwipeContent} {...contentResponder?.panHandlers}>
                {children}
              </View>
            ) : (
              children
            )}
          </Container>
        </Animated.View>
      </View>
    </Modal>
  );
}
