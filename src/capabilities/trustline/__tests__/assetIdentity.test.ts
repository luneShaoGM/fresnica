import {StrKey} from '@stellar/stellar-sdk';

import {validateTrustlineAsset} from '../prepareTrustline';

const issuer = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(52));

describe('Trustline asset identity', () => {
  it('preserves protocol-valid issued asset code case exactly', () => {
    expect(validateTrustlineAsset({code: 'usd', issuer})).toEqual({code: 'usd', issuer});
    expect(validateTrustlineAsset({code: 'USD', issuer})).toEqual({code: 'USD', issuer});
    expect(validateTrustlineAsset({code: 'usd', issuer})).not.toEqual(
      validateTrustlineAsset({code: 'USD', issuer}),
    );
  });
});
