import React from 'react';
import {
  Animated,
  Modal,
  KeyboardAvoidingView,
  Text,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppModal } from '../AppModal';
import { createAppearanceTheme } from '../../../theme/appearanceTheme';

let mockActiveTheme: ReturnType<typeof createAppearanceTheme> | undefined;
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
  return {
    ...actual,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(mockActiveTheme ?? actual.defaultTheme),
  };
});

type ElementProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  gesture?: unknown;
  behavior?: React.ComponentProps<typeof KeyboardAvoidingView>['behavior'];
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
  mockActiveTheme = undefined;
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

  it('uses the same background across the sheet shell, handle and bottom safe area in light and dark themes', () => {
    for (const dark of [false, true]) {
      const theme = createAppearanceTheme(dark);
      mockActiveTheme = theme;
      const sheet = AppModal({
        visible: true,
        presentation: 'sheet',
        swipeToDismiss: true,
        sheetBackground: 'background',
        onRequestClose: jest.fn(),
      });
      const nodes = elements(sheet);
      const surface = nodes.find(node => node.type === Animated.View)!;
      expect(StyleSheet.flatten(surface.props.style)?.backgroundColor).toBe(theme.colors.background);
      const safeArea = nodes.find(node => node.type === SafeAreaView)!;
      expect(safeArea.props.edges).toEqual(['bottom']);
      // The transparent handle and safe-area inset inherit the same parent background.
      expect(StyleSheet.flatten(safeArea.props.style)?.backgroundColor).toBeUndefined();
      expect(nodes.some(node => node.props.accessibilityLabel === 'Drag down to close')).toBe(true);
      expect(surfaceStyle('sheet', true).backgroundColor).toBe(theme.colors.surface);
      expect(surfaceStyle('dialog', false).backgroundColor).toBe(theme.colors.surface);
    }
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
    expect(springStart).toHaveBeenCalledTimes(3);

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
});

describe('explicit Android keyboard avoidance', () => {
  it.each([
    { platform: 'android' as const, presentation: 'dialog' as const },
    { platform: 'android' as const, presentation: 'sheet' as const },
    { platform: 'ios' as const, presentation: 'dialog' as const },
    { platform: 'ios' as const, presentation: 'sheet' as const },
  ])('keeps the existing $platform $presentation scroller and dismissal callback', ({ platform, presentation }) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const close = jest.fn();
    const body = React.createElement(ScrollView, { keyboardShouldPersistTaps: 'handled' });
    const root = AppModal({
      visible: true,
      presentation,
      avoidAndroidKeyboard: true,
      onRequestClose: close,
      children: body,
    });
    const nodes = elements(root);
    const avoiding = nodes.find(node => node.type === KeyboardAvoidingView);
    if (platform === 'android') expect(avoiding?.props.behavior).toBe('height');
    else expect(avoiding).toBeUndefined();
    const scrollers = nodes.filter(node => node.type === ScrollView);
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0].props).toEqual(body.props);
    expect(root.props.onRequestClose).toBe(close);
  });
});

describe('scrollable dialog', () => {
  it.each([
    { presentation: 'dialog' as const, scrollable: false },
    { presentation: 'sheet' as const, scrollable: true },
  ])('keeps existing $presentation content outside opt-in keyboard avoidance', props => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const body = React.createElement(ScrollView);
    const root = AppModal({ visible: true, onRequestClose: jest.fn(), children: body, ...props });
    const nodes = elements(root);
    expect(nodes.some(node => node.type === KeyboardAvoidingView)).toBe(false);
    const scrollers = nodes.filter(node => node.type === ScrollView);
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0].props).toEqual(body.props);
  });

  it.each([
    ['ios', 'padding'],
    ['android', 'height'],
  ] as const)('keeps long content together with %s keyboard avoidance', (platform, behavior) => {
    jest.replaceProperty(Platform, 'OS', platform);
    const confirm = jest.fn();
    const close = jest.fn();
    const title = 'A title that wraps on small screens';
    const root = AppModal({
      visible: true,
      scrollable: true,
      title,
      description: 'A long explanation '.repeat(30),
      onRequestClose: close,
      children: React.createElement(Pressable, { onPress: confirm }, React.createElement(Text, null, 'Confirm')),
    });
    const nodes = elements(root);
    expect(nodes.find(node => node.type === KeyboardAvoidingView)?.props.behavior).toBe(behavior);
    const scroll = nodes.find(node => node.type === ScrollView)!;
    expect(scroll).toBeDefined();
    const content = elements(scroll);
    expect(content.some(node => node.type === Text && node.props.children === title)).toBe(true);
    content.find(node => node.type === Pressable)?.props.onPress?.();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    root.props.onRequestClose?.({} as never);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
