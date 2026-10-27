import { isQuotableSwapAmount, normalizeSwapAmountInput, SwapAmountInput } from '../SwapAmountInput';

it.each([
  ['1,25', '1.25'],
  ['.5', '0.5'],
  ['00012.5', '12.5'],
  ['', ''],
  ['0.', '0.'],
])('normalizes formatting without changing value: %s', (value, expected) => {
  expect(normalizeSwapAmountInput(value)).toBe(expected);
});
it.each(['-5', '1e3', '1.2.3', '1,000.00', '1.23456789', 'abc5'])('preserves and rejects invalid input: %s', value => {
  expect(normalizeSwapAmountInput(value)).toBe(value);
  expect(isQuotableSwapAmount(value)).toBe(false);
});
it.each(['0', '0.0000000', '922337203685.4775808', '9'.repeat(100)])(
  'blocks zero and out-of-range amounts: %s',
  value => {
    expect(isQuotableSwapAmount(value)).toBe(false);
  },
);
it.each(['0.0000001', '1.0000000', '922337203685.4775807'])('accepts an exact valid Stellar amount: %s', value => {
  expect(isQuotableSwapAmount(value)).toBe(true);
});
it('keeps the input disabled during a quote and normalizes decimal-keyboard input', () => {
  const change = jest.fn();
  const root = SwapAmountInput({
    accessibilityLabel: 'Amount',
    disabled: true,
    onChangeAmount: change,
    value: '',
    style: {},
  });
  expect(root.props.editable).toBe(false);
  root.props.onChangeText('1,25');
  expect(change).toHaveBeenCalledWith('1.25');
});
