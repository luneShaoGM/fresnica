import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View, type ModalProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

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
    nativeScrollGesture?: ReturnType<typeof Gesture.Native>;
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
  nativeScrollGesture,
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
  // A native Pan gesture is simultaneous with the native ScrollView handler.
  // Android stops delivering JS touch events after native scrolling starts, so a
  // parent PanResponder or raw onTouch callback cannot handle this handoff.
  const contentPan = useMemo(() => {
    if (!scrollContentAtTop || !nativeScrollGesture) return undefined;
    let anchorY: number | undefined;
    let dragY = 0;
    const rebound = () => Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
    return Gesture.Pan()
      .minDistance(8)
      .maxPointers(1)
      .simultaneousWithExternalGesture(nativeScrollGesture)
      .runOnJS(true)
      .onStart(() => {
        anchorY = undefined;
        dragY = 0;
        offsetY.stopAnimation();
      })
      .onUpdate(event => {
        if (anchorY === undefined) {
          if (!scrollContentAtTop()) return;
          // The first event observed at the top can include native scroll travel.
          // Anchor here and count only movement from subsequent updates.
          anchorY = event.translationY;
          return;
        }
        // Once top is reached, native scroll offsets can jitter around zero.
        // Do not reset the drag anchor during the remainder of this finger gesture.
        dragY = Math.max(0, event.translationY - anchorY);
        offsetY.setValue(dragY);
      })
      .onEnd((event, success) => {
        if (!success) return; // Interrupted gestures rebound in onFinalize.
        if (shouldDismissSheetSwipe(dragY, event.velocityY / 1000)) {
          onRequestClose();
        } else {
          rebound();
        }
      })
      .onFinalize((_, success) => {
        if (!success) rebound();
      });
  }, [nativeScrollGesture, scrollContentAtTop, offsetY, onRequestClose]);

  const Container = presentation === 'sheet' ? SafeAreaView : View;
  const ModalRoot = contentPan ? GestureHandlerRootView : View;
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
      <ModalRoot style={[styles.overlay, presentation === 'sheet' ? styles.sheetOverlay : undefined]}>
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
            {draggable && contentPan ? (
              <GestureDetector gesture={contentPan}>
                <View style={styles.sheetSwipeContent} collapsable={false}>
                  {children}
                </View>
              </GestureDetector>
            ) : (
              children
            )}
          </Container>
        </Animated.View>
      </ModalRoot>
    </Modal>
  );
}
