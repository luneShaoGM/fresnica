import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type ModalProps,
} from 'react-native';
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
  // Raw touch callbacks continue to fire while the inner ScrollView owns (and refuses to
  // relinquish) the RN responder. Do not negotiate a second PanResponder for the body.
  const contentTouchHandlers = useMemo(() => {
    if (!scrollContentAtTop) return undefined;
    type Trace = {
      lastX: number;
      lastY: number;
      lastTime: number;
      topPull: number;
      wasAtTop: boolean;
      anchorY: number | null;
      distance: number;
      velocityY: number;
    };
    let trace: Trace | undefined;
    const begin = (event: GestureResponderEvent) => {
      const { pageX, pageY, timestamp } = event.nativeEvent;
      trace = {
        lastX: pageX,
        lastY: pageY,
        lastTime: timestamp,
        topPull: 0,
        wasAtTop: scrollContentAtTop(),
        anchorY: null,
        distance: 0,
        velocityY: 0,
      };
    };
    const rebound = () => Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
    const finish = (cancelled: boolean) => {
      const finished = trace;
      trace = undefined;
      if (finished?.anchorY == null) return;
      if (!cancelled && shouldDismissSheetSwipe(finished.distance, finished.velocityY)) {
        onRequestClose();
      } else {
        rebound();
      }
    };
    return {
      onTouchStartCapture: (event: GestureResponderEvent) => {
        if (!draggable || event.nativeEvent.touches.length !== 1) {
          finish(true);
          return;
        }
        begin(event);
      },
      onTouchMoveCapture: (event: GestureResponderEvent) => {
        if (!draggable) return;
        if (event.nativeEvent.touches.length !== 1) {
          finish(true);
          return;
        }
        const { pageX, pageY, timestamp } = event.nativeEvent;
        if (!trace) {
          begin(event);
          return;
        }
        const dy = pageY - trace.lastY;
        const dx = pageX - trace.lastX;
        const elapsed = timestamp - trace.lastTime;
        trace.lastX = pageX;
        trace.lastY = pageY;
        trace.lastTime = timestamp;
        if (trace.anchorY === null) {
          const atTop = scrollContentAtTop();
          // The move that first reaches the top can include distance consumed by scrolling.
          // Start measuring on the next move, so consumed scroll travel never moves the sheet.
          if (!atTop || !trace.wasAtTop || dy <= 0 || dy <= Math.abs(dx)) {
            trace.wasAtTop = atTop;
            trace.topPull = 0;
            return;
          }
          trace.topPull += dy;
          if (trace.topPull <= 8) return;
          // Ignore distance spent scrolling; the sheet moves only for pull travel at the top.
          trace.anchorY = pageY - trace.topPull;
          offsetY.stopAnimation();
        }
        trace.distance = Math.max(0, pageY - trace.anchorY);
        trace.velocityY = dy > 0 && elapsed > 0 ? dy / elapsed : 0;
        offsetY.setValue(trace.distance);
      },
      onTouchEndCapture: () => finish(false),
      onTouchCancelCapture: () => finish(true),
    };
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
              <View style={styles.sheetSwipeContent} {...contentTouchHandlers}>
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
