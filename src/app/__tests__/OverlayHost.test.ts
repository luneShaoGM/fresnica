import React from 'react';
import { Modal, Text } from 'react-native';
import { AppModal } from '@ui/components/AppModal';
import { OverlayHost } from '../OverlayHost';

const mockState: unknown[] = [];
let mockStateIndex = 0;
let mockRetireRef: { current: unknown } = { current: undefined };
const mockCleanups: Array<() => void> = [];
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const index = mockStateIndex++;
    if (!(index in mockState)) mockState[index] = initial;
    return [
      mockState[index],
      (value: unknown) => {
        mockState[index] = value;
      },
    ];
  },
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useRef: () => mockRetireRef,
  useEffect: (effect: () => () => void) => mockCleanups.push(effect()),
}));

function renderHost() {
  mockStateIndex = 0;
  return OverlayHost({ children: null });
}

beforeEach(() => {
  mockState.length = 0;
  mockRetireRef = { current: undefined };
  mockCleanups.length = 0;
});

it('closes the sheet without unmounting its native transition and reopens with fresh content', () => {
  const initial = renderHost();
  const firstContent = React.createElement(Text, null, 'First account');
  const retire = jest.fn();
  initial.props.value.present('actions', firstContent, {
    presentation: 'sheet',
    statusBarContent: 'light',
    closeLabel: 'Close',
    dragDismissLabel: 'Drag',
    onRetire: retire,
  });
  const open = renderHost();
  expect(open.props.value.activeOverlayId).toBe('actions');
  const sheet = React.Children.toArray(open.props.children).find(
    (node): node is React.ReactElement<React.ComponentProps<typeof AppModal>> =>
      React.isValidElement(node) && node.type === AppModal,
  )!;
  expect(sheet.props).toMatchObject({
    visible: true,
    presentation: 'sheet',
    animationType: 'slide',
    contentSized: true,
    swipeToDismiss: true,
    closeLabel: 'Close',
    dragDismissLabel: 'Drag',
  });
  sheet.props.onRequestClose();
  expect(retire).toHaveBeenCalledTimes(1);
  sheet.props.onRequestClose();
  expect(retire).toHaveBeenCalledTimes(1);
  const closed = renderHost();
  expect(closed.props.value.activeOverlayId).toBeUndefined();
  const hidden = React.Children.toArray(closed.props.children).find(
    (node): node is React.ReactElement<React.ComponentProps<typeof AppModal>> =>
      React.isValidElement(node) && node.type === AppModal,
  )!;
  expect(hidden.props.visible).toBe(false);

  const nextContent = React.createElement(Text, null, 'Second account');
  closed.props.value.present('actions', nextContent, { presentation: 'sheet' });
  const reopened = renderHost();
  const next = React.Children.toArray(reopened.props.children).find(
    (node): node is React.ReactElement<React.ComponentProps<typeof AppModal>> =>
      React.isValidElement(node) && node.type === AppModal,
  )!;
  expect(next.props.visible).toBe(true);
  const text = React.Children.toArray(next.props.children).filter(
    (node): node is React.ReactElement<{ children: string }> => React.isValidElement(node) && node.type === Text,
  );
  expect(text.map(node => node.props.children)).toEqual(['Second account']);
});

it('preserves the default non-sheet overlay presentation and system-back dismissal', () => {
  const retire = jest.fn();
  renderHost().props.value.present('other', null, { onRetire: retire });
  const open = renderHost();
  const modal = React.Children.toArray(open.props.children).find(
    (node): node is React.ReactElement<React.ComponentProps<typeof Modal>> =>
      React.isValidElement(node) && node.type === Modal,
  )!;
  expect(modal.props).toMatchObject({ visible: true, animationType: 'fade', transparent: true });
  modal.props.onRequestClose?.({} as never);
  expect(retire).toHaveBeenCalledTimes(1);
  expect(renderHost().props.value.activeOverlayId).toBeUndefined();
});

it('retires replaced content and the final content at host unmount', () => {
  const host = renderHost();
  const first = jest.fn();
  const second = jest.fn();
  host.props.value.present('actions', null, { onRetire: first });
  host.props.value.present('actions', null, { onRetire: second });
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).not.toHaveBeenCalled();
  mockCleanups[0]();
  expect(second).toHaveBeenCalledTimes(1);
});
