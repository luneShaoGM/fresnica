import React, { createContext, useContext, useState } from 'react';
import { ScrollView, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';

const UNMEASURED = { offset: 0, height: 0 };
const ActionsViewport = createContext(UNMEASURED);

export function ActionsScrollView(
  props: Pick<ScrollViewProps, 'children' | 'bounces' | 'style' | 'contentContainerStyle'>,
) {
  const [viewport, setViewport] = useState(UNMEASURED);
  return (
    <ScrollView
      {...props}
      scrollEventThrottle={16}
      onLayout={({ nativeEvent }) => {
        const height = nativeEvent.layout.height;
        setViewport(previous => ({ ...previous, height }));
      }}
      onScroll={({ nativeEvent }) =>
        setViewport({ offset: nativeEvent.contentOffset.y, height: nativeEvent.layoutMeasurement.height })
      }
    >
      <ActionsViewport.Provider value={viewport}>{props.children}</ActionsViewport.Provider>
    </ScrollView>
  );
}

// The featured root is a direct content child; the horizontal list's y is relative to that root.
export function useActionsCardsViewport() {
  const viewport = useContext(ActionsViewport) ?? UNMEASURED;
  const [sectionTop, setSectionTop] = useState<number>();
  const [cards, setCards] = useState<{ y: number; height: number }>();
  const top = sectionTop !== undefined && cards ? sectionTop + cards.y : undefined;
  const inVerticalViewport =
    top !== undefined &&
    cards !== undefined &&
    viewport.height > 0 &&
    Math.min(top + cards.height, viewport.offset + viewport.height) > Math.max(top, viewport.offset);
  return {
    inVerticalViewport,
    onLayout: (event: LayoutChangeEvent) => setSectionTop(event.nativeEvent.layout.y),
    onCardsLayout: (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      setCards({ y, height });
    },
  };
}
