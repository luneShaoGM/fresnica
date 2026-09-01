import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

type Props = Readonly<{
  label: string;
  onComplete: () => void;
  disabled?: boolean;
  loading?: boolean;
  color?: string;
}>;

const KNOB_SIZE = 50;
const TRACK_PADDING = 4;

export function SlideToConfirm({
  label,
  onComplete,
  disabled = false,
  loading = false,
  color = '#00CA8A',
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const maxTravel = Math.max(0, trackWidth - KNOB_SIZE - TRACK_PADDING * 2);
  const disabledRef = useRef(disabled || loading);
  const maxTravelRef = useRef(maxTravel);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    disabledRef.current = disabled || loading;
  }, [disabled, loading]);

  useEffect(() => {
    maxTravelRef.current = maxTravel;
  }, [maxTravel]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!loading) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 0,
      }).start();
    }
  }, [loading, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !disabledRef.current && gesture.dx > 2 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_event, gesture) => {
          const clamped = Math.max(0, Math.min(maxTravelRef.current, gesture.dx));
          translateX.setValue(clamped);
        },
        onPanResponderRelease: (_event, gesture) => {
          const destination = maxTravelRef.current;
          if (!disabledRef.current && destination > 0 && gesture.dx >= destination * 0.72) {
            Animated.timing(translateX, {
              toValue: destination,
              duration: 110,
              useNativeDriver: true,
            }).start(({finished}) => {
              if (finished) {
                onCompleteRef.current();
              }
            });
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 24,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            speed: 24,
            bounciness: 0,
          }).start();
        },
      }),
    [translateX],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const triggerAccessibleComplete = () => {
    if (!disabledRef.current) {
      onCompleteRef.current();
    }
  };

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{disabled: disabled || loading, busy: loading}}
      onAccessibilityTap={triggerAccessibleComplete}
      onLayout={onLayout}
      style={[
        styles.track,
        {backgroundColor: color},
        disabled || loading ? styles.disabled : undefined,
      ]}>
      <Text style={styles.label}>{loading ? 'Submitting…' : label}</Text>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.knob, {transform: [{translateX}]}]}>
        {loading ? (
          <ActivityIndicator color={color} size="small" />
        ) : (
          <Text style={[styles.arrow, {color}]}>››</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: TRACK_PADDING,
  },
  disabled: {opacity: 0.46},
  label: {
    position: 'absolute',
    left: 64,
    right: 18,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
  arrow: {fontSize: 20, lineHeight: 22, fontWeight: '900', letterSpacing: -3},
});
