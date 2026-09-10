import {validateTrustlineAsset} from '../prepareTrustline';

const issuer = 'GISSUER';
const isClassicAddress = (address: string) => address.startsWith('G');

describe('Trustline asset identity', () => {
  it('preserves protocol-valid issued asset code case exactly', () => {
    expect(validateTrustlineAsset({code: 'usd', issuer}, isClassicAddress)).toEqual({
      code: 'usd',
      issuer,
    });
    expect(validateTrustlineAsset({code: 'USD', issuer}, isClassicAddress)).toEqual({
      code: 'USD',
      issuer,
    });
    expect(validateTrustlineAsset({code: 'usd', issuer}, isClassicAddress)).not.toEqual(
      validateTrustlineAsset({code: 'USD', issuer}, isClassicAddress),
    );
  });
});
