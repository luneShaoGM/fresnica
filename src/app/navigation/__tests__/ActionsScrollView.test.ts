import React from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ActionsScrollView, useActionsCardsViewport } from '../ActionsScrollView';

type Viewport = { offset: number; height: number };
const mockStores = new Map<string, unknown[]>();
let mockStore: unknown[];
let mockIndex = 0;
let mockViewport: Viewport = { offset: 0, height: 0 };
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: () => mockViewport,
  useState: (initial: unknown) => {
    const values = mockStore;
    const index = mockIndex++;
    if (!(index in values)) values[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      values[index],
      (value: unknown) => {
        values[index] =
          typeof value === 'function' ? (value as (mockPrevious: unknown) => unknown)(values[index]) : value;
      },
    ];
  },
}));
function render<T>(owner: string, run: () => T): T {
  mockStore = mockStores.get(owner) ?? [];
  mockStores.set(owner, mockStore);
  mockIndex = 0;
  return run();
}
function scroll() {
  const tree = render('scroll', () => ActionsScrollView({ children: null }));
  const provider = tree.props.children;
  if (!React.isValidElement<{ value: Viewport }>(provider)) throw new Error('viewport-provider-missing');
  mockViewport = provider.props.value;
  return tree;
}
function cards() {
  return render('cards', useActionsCardsViewport);
}
const layout = (y: number, height: number) =>
  ({ nativeEvent: { layout: { x: 0, y, width: 320, height } } }) as LayoutChangeEvent;
function reportScroll(y: number, height: number) {
  scroll().props.onScroll({
    nativeEvent: { contentOffset: { x: 0, y }, layoutMeasurement: { width: 320, height } },
  } as NativeSyntheticEvent<NativeScrollEvent>);
  scroll();
}
beforeEach(() => {
  mockStores.clear();
  mockViewport = { offset: 0, height: 0 };
});

it('requires measured card-row intersection with the outer viewport, then tracks vertical exit and re-entry', () => {
  scroll();
  expect(cards().inVerticalViewport).toBe(false);
  scroll().props.onLayout(layout(0, 120));
  scroll();
  cards().onLayout(layout(300, 200));
  expect(cards().inVerticalViewport).toBe(false);
  cards().onCardsLayout(layout(30, 110));
  expect(cards().inVerticalViewport).toBe(false); // Four Recent entries can keep the row below a short viewport.
  reportScroll(250, 120);
  expect(cards().inVerticalViewport).toBe(true);
  reportScroll(440, 120);
  expect(cards().inVerticalViewport).toBe(false); // Touching the bottom edge is not an intersection.
  reportScroll(300, 120);
  expect(cards().inVerticalViewport).toBe(true);
  reportScroll(0, 120);
  expect(cards().inVerticalViewport).toBe(false);
});

it('ignores a visible heading when cards are clipped and recomputes for viewport and content layout changes', () => {
  scroll().props.onLayout(layout(0, 120));
  scroll();
  cards().onLayout(layout(90, 240));
  cards().onCardsLayout(layout(40, 110));
  expect(cards().inVerticalViewport).toBe(false); // Heading is visible; card row starts at y=130.
  scroll().props.onLayout(layout(0, 300));
  scroll();
  expect(cards().inVerticalViewport).toBe(true);
  cards().onLayout(layout(350, 240));
  expect(cards().inVerticalViewport).toBe(false);
  reportScroll(350, 120);
  expect(cards().inVerticalViewport).toBe(true);
  cards().onCardsLayout(layout(140, 110));
  expect(cards().inVerticalViewport).toBe(false);
});
