import { isQuotableSwapAmount, normalizeSwapAmountInput, SwapAmountInput } from '../SwapAmountInput';

describe('SwapAmountInput', () => {
  it('normalizes typed and pasted decimal values without losing valid intermediate input', () => {
    expect(normalizeSwapAmountInput(',')).toBe('0.');
    expect(normalizeSwapAmountInput('01,23456789')).toBe('1.2345678');
    expect(normalizeSwapAmountInput(' 12a.3.4 ')).toBe('12.34');
    expect(normalizeSwapAmountInput('')).toBe('');
  });

  it('starts quoting only for positive canonical Stellar amounts', () => {
    expect(isQuotableSwapAmount('')).toBe(false);
    expect(isQuotableSwapAmount('0.')).toBe(false);
    expect(isQuotableSwapAmount('0.0000000')).toBe(false);
    expect(isQuotableSwapAmount('0.0000001')).toBe(true);
    expect(isQuotableSwapAmount('1.2345678')).toBe(true);
    expect(isQuotableSwapAmount('1.23456789')).toBe(false);
  });

  it('routes native TextInput typing and paste through the canonicalizer', () => {
    const onChangeAmount = jest.fn();
    const input = SwapAmountInput({
      accessibilityLabel: 'Pay amount',
      disabled: false,
      onChangeAmount,
      style: {},
      value: '',
    });
    input.props.onChangeText?.(' 01,25000009 USDC ');
    expect(onChangeAmount).toHaveBeenCalledWith('1.2500000');
  });
});
