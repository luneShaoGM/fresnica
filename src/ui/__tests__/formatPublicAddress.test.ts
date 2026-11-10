import { formatPublicAddress } from '../formatPublicAddress';
it('shortens only presentation and preserves both ends of the identity', () => {
  expect(formatPublicAddress('GABCD123456XYZ')).toBe('GABC...6XYZ');
  expect(formatPublicAddress('short')).toBe('short');
  expect(formatPublicAddress('  GABCD123456XYZ  ')).toBe('GABC...6XYZ');
  expect(formatPublicAddress('12345678')).toBe('12345678');
  expect(formatPublicAddress('123456789')).toBe('1234...6789');
  expect(formatPublicAddress('   ')).toBe('');
});
