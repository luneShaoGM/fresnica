import {StrKey} from '@stellar/stellar-sdk';

import {sendAssetKey, validateSendDraft} from '../sendDraft';

const destination = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const issuer = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));

describe('sendDraft', () => {
  it('preserves a valid seven-decimal native payment without number conversion', () => {
    expect(
      validateSendDraft({
        destination: ` ${destination} `,
        amount: '12.3456789',
        memo: 'hello',
        asset: {kind: 'native', code: 'XLM'},
      }),
    ).toEqual({
      destination,
      amount: '12.3456789',
      memo: 'hello',
      asset: {kind: 'native'},
    });
  });

  it('maps an issued asset using the full code and issuer identity', () => {
    expect(
      validateSendDraft({
        destination,
        amount: '1.0000000',
        memo: '',
        asset: {kind: 'credit', code: 'USD', issuer},
      }),
    ).toEqual({
      destination,
      amount: '1.0000000',
      asset: {kind: 'credit', code: 'USD', issuer},
    });
    expect(sendAssetKey({kind: 'credit', code: 'USD', issuer})).toBe(
      `USD:${issuer}`,
    );
  });

  it('rejects invalid or non-Classic payment destinations', () => {
    expect(() =>
      validateSendDraft({
        destination: 'not-a-stellar-account',
        amount: '1',
        memo: '',
        asset: {kind: 'native', code: 'XLM'},
      }),
    ).toThrow('invalid-payment-destination');
  });

  it('rejects zero, negative and more-than-seven-decimal amounts', () => {
    for (const amount of ['0', '0.0000000', '-1', '1.00000000', '01.5']) {
      expect(() =>
        validateSendDraft({
          destination,
          amount,
          memo: '',
          asset: {kind: 'native', code: 'XLM'},
        }),
      ).toThrow();
    }
  });

  it('enforces the Stellar text memo limit in UTF-8 bytes', () => {
    expect(() =>
      validateSendDraft({
        destination,
        amount: '1',
        memo: '你'.repeat(10),
        asset: {kind: 'native', code: 'XLM'},
      }),
    ).toThrow('payment-memo-too-long');

    expect(
      validateSendDraft({
        destination,
        amount: '1',
        memo: '你'.repeat(9),
        asset: {kind: 'native', code: 'XLM'},
      }).memo,
    ).toBe('你'.repeat(9));
  });
});
