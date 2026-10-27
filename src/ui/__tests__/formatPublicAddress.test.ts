import { formatPublicAddress } from '../formatPublicAddress';
it('shortens only presentation and preserves both ends of the identity', () => {
  expect(formatPublicAddress('GABCD123456XYZ')).toBe('GABC****6XYZ');
  expect(formatPublicAddress('short')).toBe('short');
});
