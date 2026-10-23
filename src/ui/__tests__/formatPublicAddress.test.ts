import { formatPublicAddress } from '../formatPublicAddress';

describe('formatPublicAddress', () => {
  it('keeps the first four and last four characters around a fixed mask', () => {
    expect(formatPublicAddress('GABCDEFGHIJKLMNOPQRSTUVWXYZ234567')).toBe('GABC****4567');
  });

  it('leaves an already short value unchanged', () => {
    expect(formatPublicAddress('GABC')).toBe('GABC');
    expect(formatPublicAddress('  GSHORT1 ')).toBe('GSHORT1');
  });
});
