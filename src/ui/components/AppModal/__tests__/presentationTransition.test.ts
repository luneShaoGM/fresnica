import React from 'react';
import { Animated, PanResponder, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppModal } from '../AppModal';

let mockOffset: Animated.Value;
const mockEffects: Array<() => void> = [];

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: () => ({ current: mockOffset }),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: () => void) => {
    mockEffects.push(effect);
  },
}));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});

type ElementProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

function elements(root: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(elements)];
}

function surfaceStyle(presentation: 'sheet' | 'dialog', swipeToDismiss: boolean) {
  const element = elements(AppModal({ visible: true, presentation, swipeToDismiss, onRequestClose: jest.fn() })).find(
    item => item.type === Animated.View,
  );
  if (!element) throw new Error('Missing AppModal animated surface');
  return StyleSheet.flatten(element.props.style) ?? {};
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEffects.length = 0;
  mockOffset = new Animated.Value(0);
});
afterEach(() => jest.restoreAllMocks());

describe('AppModal sheet-to-dialog drag handoff', () => {
  it('does not move the dialog while a short sheet-drag rebound is still pending', () => {
    const createResponder = jest.spyOn(PanResponder, 'create');
    const animationStart = jest.fn();
    jest
      .spyOn(Animated, 'spring')
      .mockReturnValue({ start: animationStart } as unknown as ReturnType<typeof Animated.spring>);
    const stop = jest.spyOn(mockOffset, 'stopAnimation');
    const reset = jest.spyOn(mockOffset, 'setValue');

    const sheetStyle = surfaceStyle('sheet', true);
    expect(sheetStyle.transform).toEqual([{ translateY: mockOffset }]);
    mockEffects.splice(0).forEach(run => run());

    mockOffset.setValue(40);
    const responder = createResponder.mock.lastCall?.[0];
    responder?.onPanResponderRelease?.({} as never, { dy: 40, vy: 0.25 } as never);
    expect(animationStart).toHaveBeenCalledTimes(1);

    const dialogStyle = surfaceStyle('dialog', false);
    // The dialog must be centered on its very first render, before effects run.
    expect(dialogStyle.transform).toBeUndefined();
    mockEffects.splice(0).forEach(run => run());
    expect(stop).toHaveBeenCalled();
    expect(reset).toHaveBeenCalledWith(0);
    expect(surfaceStyle('sheet', true).transform).toEqual([{ translateY: mockOffset }]);
  });
});
