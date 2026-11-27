import { Account, MuxedAccount, StrKey } from '@stellar/stellar-sdk/axios';
import { embeddedClassicAddress } from '../embeddedClassicAddress';

const key = new Uint8Array(32).fill(4);
const address = StrKey.encodeEd25519PublicKey(key);

it('returns a classic address and the classic account embedded in a muxed address', () => {
  const muxed = new MuxedAccount(new Account(address, '0'), '9').accountId();
  expect(embeddedClassicAddress(address)).toBe(address);
  expect(embeddedClassicAddress(muxed)).toBe(address);
  expect(muxed).not.toBe(address);
});

it('leaves checksum-invalid display strings unresolved', () => {
  expect(embeddedClassicAddress('G' + 'A'.repeat(55))).toBeUndefined();
  expect(embeddedClassicAddress('M' + 'B'.repeat(68))).toBeUndefined();
  expect(embeddedClassicAddress('secret')).toBeUndefined();
});
