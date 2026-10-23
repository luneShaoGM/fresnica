import {
  formatSlippagePermille,
  formatSwapRate,
  normalizeSlippagePermille,
  parseSlippagePermille,
} from '../swapPresentation';

describe('Swap presentation arithmetic', () => {
  it('formats a deterministic seven-decimal asset rate without floating-point arithmetic', () => {
    expect(formatSwapRate('3.0000000', '10.0000000')).toBe('3.3333333');
    expect(formatSwapRate('0', '10')).toBe('—');
    expect(formatSwapRate('invalid', '10')).toBe('—');
  });

  it('converts Stellar-style per-mille input to bounded basis points and back', () => {
    expect(parseSlippagePermille('1')).toBe(10);
    expect(parseSlippagePermille('5')).toBe(50);
    expect(parseSlippagePermille('100')).toBe(1000);
    expect(parseSlippagePermille('101')).toBeUndefined();
    expect(parseSlippagePermille('0')).toBeUndefined();
    expect(parseSlippagePermille('1.5')).toBeUndefined();
    expect(formatSlippagePermille(50)).toBe('5‰');
    expect(formatSlippagePermille(100)).toBe('10‰');
    expect(normalizeSlippagePermille('', '5')).toBe('5');
    expect(normalizeSlippagePermille('0', '5')).toBe('1');
    expect(normalizeSlippagePermille('1000', '5')).toBe('100');
  });
});
