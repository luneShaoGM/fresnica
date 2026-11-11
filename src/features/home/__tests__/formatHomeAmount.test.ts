import { formatHomeAmount } from '../formatHomeAmount';

it.each([
  ['0.0000000', '0'],
  ['12.0000000', '12'],
  ['1234567.1234000', '1,234,567.1234'],
  ['0.0000001', '0.0000001'],
  ['-1234.0000100', '-1,234.00001'],
  ['9007199254740993.1234567', '9,007,199,254,740,993.1234567'],
  ['0.000000000000000000001', '0.000000000000000000001'],
  ['—', '—'],
  ['1e-7', '1e-7'],
])('formats %s without losing a significant decimal digit', (value, expected) => {
  expect(formatHomeAmount(value)).toBe(expected);
});
