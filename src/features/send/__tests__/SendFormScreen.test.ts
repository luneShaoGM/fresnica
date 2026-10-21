import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { defaultTheme } from '@ui/theme';

import { SendFormScreen } from '../SendFormScreen';
import { createSendFormStyles } from '../styles';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) =>
      ({
        'send.navigation.cancel': 'localized:cancel-send',
        'send.memo.type.none': 'None',
        'send.memo.type.text': 'Text',
        'send.memo.type.id': 'ID',
        'send.memo.type.hash': 'Hash',
        'send.memo.input.id': 'ID memo',
        'send.memo.placeholder.id': 'Unsigned 64-bit decimal ID',
        'send.memo.hint.id': 'Decimal ID hint',
      })[key] ?? key,
  }),
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityState?: { selected?: boolean };
  onPress?: () => void;
  keyboardType?: string;
  value?: string;
  label?: string;
  disabled?: boolean;
  size?: string;
  variant?: string;
  style?: unknown;
  scrollable?: boolean;
  contentInset?: string;
  keyboardShouldPersistTaps?: string;
  showsVerticalScrollIndicator?: boolean;
}>;
function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function renderForm(onSelectMemoType = jest.fn(), building = false) {
  const onCancel = jest.fn();
  return {
    onSelectMemoType,
    onCancel,
    root: SendFormScreen({
      accountLabel: 'Primary',
      balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '10.0000000' }],
      selectedAsset: { kind: 'native', code: 'XLM' },
      destination: 'GDESTINATION',
      amount: '1',
      memoType: 'id',
      memoValue: '0007',
      building,
      onSelectAsset: jest.fn(),
      onChangeDestination: jest.fn(),
      onChangeAmount: jest.fn(),
      onSelectMemoType,
      onChangeMemoValue: jest.fn(),
      onContinue: jest.fn(),
      onCancel,
    }),
  };
}
describe('SendFormScreen memo families', () => {
  it.each([false, true])(
    'keeps Cancel send available when building=%s, without altering the form or scroll controls',
    building => {
      const { root, onCancel } = renderForm(jest.fn(), building);
      const styles = createSendFormStyles(defaultTheme);
      expect(root.type).toBe(Screen);
      expect(root.props).toMatchObject({ scrollable: false, contentInset: 'none' });

      const header = React.Children.toArray(root.props.children).find(
        (child): child is React.ReactElement<NodeProps> =>
          React.isValidElement<NodeProps>(child) && child.type === View,
      );
      expect(header?.props.style).toEqual(styles.header);

      const [left, title, right] = React.Children.toArray(header?.props.children).filter(
        (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
      );
      expect(left?.type).toBe(View);
      expect(title?.type).toBe(Text);
      expect(title?.props.children).toBe('Send');
      expect(right?.type).toBe(View);
      expect(left?.props.style).toEqual(styles.headerSide);
      expect(right?.props.style).toEqual(styles.headerSide);
      expect(styles.headerSide).toMatchObject({ flex: 1, alignItems: 'flex-start' });
      expect(styles.header).not.toHaveProperty('justifyContent', 'space-between');

      const close = React.Children.toArray(left?.props.children).filter(
        (child): child is React.ReactElement<NodeProps> =>
          React.isValidElement<NodeProps>(child) && child.type === NativeButton,
      );
      expect(close).toHaveLength(1);
      expect(close[0]?.props).toMatchObject({
        label: 'localized:cancel-send',
        size: 'sm',
        variant: 'quiet',
        onPress: onCancel,
      });
      expect(close[0]?.props.disabled).toBeUndefined();
      close[0]?.props.onPress?.();
      expect(onCancel).toHaveBeenCalledTimes(1);

      const scrolls: React.ReactElement<NodeProps>[] = [];
      visit(root, element => {
        if (element.type === ScrollView) scrolls.push(element);
      });
      expect(scrolls[0]?.props).toMatchObject({
        keyboardShouldPersistTaps: 'handled',
        showsVerticalScrollIndicator: false,
      });
    },
  );

  it('renders None/Text/ID/Hash choices with ID selected and a numeric ID input', () => {
    const { root } = renderForm();
    const memoChoices: Array<React.ReactElement<NodeProps>> = [];
    let idInput: React.ReactElement<NodeProps> | undefined;

    visit(root, element => {
      if (['None', 'Text', 'ID', 'Hash'].includes(element.props.accessibilityLabel ?? '')) {
        memoChoices.push(element);
      }
      if (element.type === TextInput && element.props.accessibilityLabel === 'ID memo') {
        idInput = element;
      }
    });

    expect(memoChoices.map(element => element.props.accessibilityLabel)).toEqual(['None', 'Text', 'ID', 'Hash']);
    expect(memoChoices.find(element => element.props.accessibilityLabel === 'ID')?.props.accessibilityState).toEqual({
      selected: true,
    });
    expect(idInput?.props.keyboardType).toBe('number-pad');
    expect(idInput?.props.value).toBe('0007');
  });

  it('routes memo-family changes through the explicit selector callback', () => {
    const { root, onSelectMemoType } = renderForm();
    let hashChoice: React.ReactElement<NodeProps> | undefined;
    visit(root, element => {
      if (element.props.accessibilityLabel === 'Hash') hashChoice = element;
    });
    hashChoice?.props.onPress?.();
    expect(onSelectMemoType).toHaveBeenCalledWith('hash');
  });

  it('does not re-select the active memo family', () => {
    const { root, onSelectMemoType } = renderForm();
    let idChoice: React.ReactElement<NodeProps> | undefined;
    visit(root, element => {
      if (element.props.accessibilityLabel === 'ID') idChoice = element;
    });
    idChoice?.props.onPress?.();
    expect(onSelectMemoType).not.toHaveBeenCalled();
  });
});
