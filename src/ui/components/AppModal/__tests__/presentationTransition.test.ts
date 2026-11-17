import React from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  onPress?: () => void;
  onAccessibilityEscape?: () => void;
  edges?: readonly string[];
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

describe('content-sized Actions sheet', () => {
  function renderSheet(visible = true) {
    const close = jest.fn();
    const root = AppModal({
      visible,
      presentation: 'sheet',
      animationType: 'slide',
      swipeToDismiss: true,
      contentSized: true,
      closeLabel: 'Close Actions',
      dragDismissLabel: 'Drag Actions',
      onRequestClose: close,
      children: React.createElement(ScrollView),
    });
    return { root, close, nodes: elements(root) };
  }

  it('caps the content-sized surface and lets scroll content shrink inside side/bottom safe areas', () => {
    const { root, nodes, close } = renderSheet();
    expect(root.type).toBe(Modal);
    expect(root.props.animationType).toBe('slide');
    const surface = nodes.find(node => node.type === Animated.View)!;
    expect(StyleSheet.flatten(surface.props.style)).toMatchObject({ height: 'auto', maxHeight: '88%', flexShrink: 1 });
    const content = nodes.find(node => node.type === SafeAreaView)!;
    expect(content.props.edges).toEqual(['right', 'bottom', 'left']);
    expect(StyleSheet.flatten(content.props.style)).toMatchObject({ flex: 0, flexShrink: 1 });
    expect(nodes.some(node => node.type === ScrollView)).toBe(true);
    nodes.find(node => node.type === Pressable && node.props.accessibilityLabel === 'Close Actions')?.props.onPress?.();
    content.props.onAccessibilityEscape?.();
    root.props.onRequestClose?.({} as never);
    expect(close).toHaveBeenCalledTimes(3);
  });

  it('does not change the fixed-height or fade defaults of existing sheet consumers', () => {
    const root = AppModal({ visible: true, presentation: 'sheet', swipeToDismiss: true, onRequestClose: jest.fn() });
    expect(root.props.animationType).toBe('fade');
    const surface = elements(root).find(node => node.type === Animated.View)!;
    expect(StyleSheet.flatten(surface.props.style)?.height).toBe('88%');
  });

  it('keeps short, upward and horizontal handle movement from dismissing; resets before reopen', () => {
    const createResponder = jest.spyOn(PanResponder, 'create');
    const springStart = jest.fn();
    jest
      .spyOn(Animated, 'spring')
      .mockReturnValue({ start: springStart } as unknown as ReturnType<typeof Animated.spring>);
    const { close } = renderSheet();
    const gesture = createResponder.mock.lastCall![0];
    expect(gesture.onMoveShouldSetPanResponder?.({} as never, { dy: -30, dx: 0 } as never)).toBe(false);
    expect(gesture.onMoveShouldSetPanResponder?.({} as never, { dy: 10, dx: 40 } as never)).toBe(false);
    expect(gesture.onMoveShouldSetPanResponder?.({} as never, { dy: 40, dx: 0 } as never)).toBe(true);
    gesture.onPanResponderRelease?.({} as never, { dy: 40, vy: 0.2 } as never);
    gesture.onPanResponderTerminate?.({} as never, {} as never);
    expect(springStart).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
    gesture.onPanResponderRelease?.({} as never, { dy: 120, vy: 0.2 } as never);
    expect(close).toHaveBeenCalledTimes(1);

    mockEffects.length = 0;
    const reset = jest.spyOn(mockOffset, 'setValue');
    renderSheet(false);
    mockEffects.splice(0).forEach(run => run());
    expect(reset).toHaveBeenCalledWith(0);
    renderSheet(true);
    const reopened = createResponder.mock.lastCall![0];
    expect(reopened.onMoveShouldSetPanResponder?.({} as never, { dy: 40, dx: 0 } as never)).toBe(true);
  });
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

  it.each([false, true])('keeps header dragging separate from body scrolling with contentSized=%s', contentSized => {
    const onClose = jest.fn();
    const header = React.createElement(Pressable, { accessibilityRole: 'button', onPress: onClose });
    const body = React.createElement(ScrollView);
    const createResponder = jest.spyOn(PanResponder, 'create');
    const modal = AppModal({
      visible: true,
      presentation: 'sheet',
      swipeToDismiss: true,
      swipeHeader: header,
      contentSized,
      dragDismissLabel: '向下拖动关闭',
      onRequestClose: onClose,
      children: body,
    });

    const dragRegion = elements(modal).find(item => item.type === View && 'onResponderMove' in item.props);
    expect(dragRegion).toBeDefined();
    expect(elements(dragRegion).some(item => item.type === Pressable)).toBe(true);
    expect(elements(dragRegion).some(item => item.type === ScrollView)).toBe(false);
    expect(elements(dragRegion).some(item => item.props.accessibilityLabel === '向下拖动关闭')).toBe(true);
    expect(elements(modal).some(item => item.type === ScrollView)).toBe(true);
    expect(
      createResponder.mock.lastCall?.[0]?.onMoveShouldSetPanResponder?.({} as never, { dy: 40, dx: 1 } as never),
    ).toBe(true);
    expect(
      createResponder.mock.lastCall?.[0]?.onMoveShouldSetPanResponder?.({} as never, { dy: -40, dx: 1 } as never),
    ).toBe(false);
    expect(header.props.onPress).toBe(onClose);

    createResponder.mock.lastCall?.[0]?.onPanResponderRelease?.({} as never, { dy: 124, vy: 0.25 } as never);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('captures downward content pulls only at the scroll top and counts only post-capture travel', () => {
    let scrollY = 150;
    const onClose = jest.fn();
    const createResponder = jest.spyOn(PanResponder, 'create');
    const offsetChange = jest.spyOn(mockOffset, 'setValue');
    const body = React.createElement(ScrollView);
    const modal = AppModal({
      visible: true,
      presentation: 'sheet',
      swipeToDismiss: true,
      scrollContentAtTop: () => scrollY <= 1,
      onRequestClose: onClose,
      children: body,
    });
    const contentRegion = elements(modal).find(
      item =>
        item.type === View &&
        'onMoveShouldSetResponderCapture' in item.props &&
        elements(item).some(child => child.type === ScrollView),
    );
    expect(contentRegion).toBeDefined();
    expect(elements(contentRegion).some(item => item.type === ScrollView)).toBe(true);
    const contentResponder = createResponder.mock.calls[1]?.[0];
    const motion = (dy: number, dx = 0, vy = 0) => ({ dy, dx, vy }) as never;

    expect(contentResponder?.onMoveShouldSetPanResponderCapture?.({} as never, motion(180))).toBe(false);
    scrollY = 0;
    expect(contentResponder?.onMoveShouldSetPanResponderCapture?.({} as never, motion(-40))).toBe(false);
    expect(contentResponder?.onMoveShouldSetPanResponderCapture?.({} as never, motion(40, 90))).toBe(false);
    expect(contentResponder?.onMoveShouldSetPanResponderCapture?.({} as never, motion(40, 2))).toBe(true);

    contentResponder?.onPanResponderGrant?.({} as never, motion(170));
    contentResponder?.onPanResponderMove?.({} as never, motion(220));
    expect(offsetChange).toHaveBeenLastCalledWith(50);
    contentResponder?.onPanResponderRelease?.({} as never, motion(300, 0, 0.2));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns the content to rest after a short pull without closing', () => {
    const onClose = jest.fn();
    const createResponder = jest.spyOn(PanResponder, 'create');
    const springStart = jest.fn();
    jest
      .spyOn(Animated, 'spring')
      .mockReturnValue({ start: springStart } as unknown as ReturnType<typeof Animated.spring>);
    AppModal({
      visible: true,
      presentation: 'sheet',
      swipeToDismiss: true,
      scrollContentAtTop: () => true,
      onRequestClose: onClose,
    });
    const contentResponder = createResponder.mock.calls[1]?.[0];
    contentResponder?.onPanResponderGrant?.({} as never, { dy: 9 } as never);
    contentResponder?.onPanResponderRelease?.({} as never, { dy: 55, vy: 0.1 } as never);
    expect(onClose).not.toHaveBeenCalled();
    expect(springStart).toHaveBeenCalledTimes(1);
  });
});
