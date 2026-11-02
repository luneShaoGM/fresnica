import React from 'react';

import { ConfirmDialog } from '../ConfirmDialog';
import { defaultTheme } from '../../theme';

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

type TestProps = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean; busy?: boolean };
  accessibilityRole?: string;
  onPress?: () => void;
  onRequestClose?: () => void;
  style?: unknown;
}>;

function find(root: React.ReactNode, predicate: (props: TestProps) => boolean): React.ReactElement<TestProps> {
  if (!React.isValidElement<TestProps>(root)) throw new Error('expected React element');
  if (predicate(root.props)) return root;
  for (const child of React.Children.toArray(root.props.children)) {
    try {
      return find(child, predicate);
    } catch {
      // Try remaining siblings.
    }
  }
  throw new Error('element not found');
}

const props = {
  visible: true,
  title: 'Delete account',
  message: 'This only removes a local account.',
  cancelLabel: 'Cancel',
  confirmLabel: 'Delete',
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
} as const;

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders Stellar-style status layout with side-by-side accessible actions', () => {
  const tree = ConfirmDialog(props);
  const cancel = find(tree, p => p.accessibilityLabel === 'Cancel');
  const confirm = find(tree, p => p.accessibilityLabel === 'Delete');
  expect(cancel.props.accessibilityState).toEqual({ disabled: false });
  expect(confirm.props.accessibilityState).toEqual({ disabled: false, busy: false });
  cancel.props.onPress?.();
  confirm.props.onPress?.();
  expect(props.onCancel).toHaveBeenCalledTimes(1);
  expect(props.onConfirm).toHaveBeenCalledTimes(1);
});

test('ignores all actions while busy and announces errors', () => {
  const tree = ConfirmDialog({ ...props, busy: true, busyLabel: 'Deleting...', error: 'Deletion failed' });
  const cancel = find(tree, p => p.accessibilityLabel === 'Cancel');
  const confirm = find(tree, p => p.accessibilityLabel === 'Deleting...');
  expect(cancel.props.accessibilityState?.disabled).toBe(true);
  expect(confirm.props.accessibilityState).toEqual({ disabled: true, busy: true });
  cancel.props.onPress?.();
  confirm.props.onPress?.();
  find(tree, p => p.accessibilityRole === 'alert');
  expect(props.onCancel).not.toHaveBeenCalled();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

test('stacks longer localized actions without losing either button', () => {
  const tree = ConfirmDialog({ ...props, cancelLabel: 'Keep this account', confirmLabel: 'Remove local account' });
  find(tree, p => p.accessibilityLabel === 'Keep this account');
  find(tree, p => p.accessibilityLabel === 'Remove local account');
  expect(defaultTheme.colors.negative).toBeDefined();
});

test('does not trigger callbacks when invisible', () => {
  const tree = ConfirmDialog({ ...props, visible: false });
  find(tree, p => p.accessibilityLabel === 'Delete').props.onPress?.();
  find(tree, p => p.accessibilityLabel === 'Cancel').props.onPress?.();
  expect(props.onCancel).not.toHaveBeenCalled();
  expect(props.onConfirm).not.toHaveBeenCalled();
});
