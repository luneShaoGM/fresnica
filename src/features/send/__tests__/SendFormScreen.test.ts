import React from 'react';
import { TextInput } from 'react-native';

import { SendFormScreen } from '../SendFormScreen';

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
}>;
function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function renderForm(onSelectMemoType = jest.fn()) {
  return {
    onSelectMemoType,
    root: SendFormScreen({
      accountLabel: 'Primary',
      balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '10.0000000' }],
      selectedAsset: { kind: 'native', code: 'XLM' },
      destination: 'GDESTINATION',
      amount: '1',
      memoType: 'id',
      memoValue: '0007',
      building: false,
      onSelectAsset: jest.fn(),
      onChangeDestination: jest.fn(),
      onChangeAmount: jest.fn(),
      onSelectMemoType,
      onChangeMemoValue: jest.fn(),
      onContinue: jest.fn(),
      onCancel: jest.fn(),
    }),
  };
}
describe('SendFormScreen memo families', () => {
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
