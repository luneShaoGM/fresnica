import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { SignerRecord } from '../../signer/types';
import { signPreparedDappTransaction } from '../signPreparedDappTransaction';

const signer: SignerRecord = {
  id: 'signer-1',
  publicKey: 'GACCOUNT',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date('2026-10-27T00:00:00Z'),
  updatedAt: new Date('2026-10-27T00:00:00Z'),
};

const review = Object.freeze({
  transactionXdrBase64: 'AAAA-exact',
  networkId: 'stellar-testnet',
  source: 'GSOURCE',
  fee: '100',
});

describe('signPreparedDappTransaction', () => {
  it('signs the reviewed XDR and does not submit it', async () => {
    const signWithPassphrase = jest.fn().mockResolvedValue('AAAA-signed');
    const sdk = {
      hasSignerSystemAuth: jest.fn().mockResolvedValue(false),
      signWithPassphrase,
    } as unknown as FresnicaSdkPort;

    await expect(
      signPreparedDappTransaction({
        sdk,
        signer,
        review,
        accountAddress: 'GACCOUNT',
        networkPassphrase: 'Test SDF Network ; September 2015',
        appPassphrase: 'secret',
      }),
    ).resolves.toEqual({ status: 'signed', signedTransactionXdrBase64: 'AAAA-signed' });
    expect(signWithPassphrase).toHaveBeenCalledWith(expect.objectContaining({ transactionXdrBase64: 'AAAA-exact' }));
  });

  it('refuses a signer that is not the account shown to the website', async () => {
    const sdk = { hasSignerSystemAuth: jest.fn() } as unknown as FresnicaSdkPort;
    await expect(
      signPreparedDappTransaction({
        sdk,
        signer,
        review,
        accountAddress: 'GOTHER',
        networkPassphrase: 'Test SDF Network ; September 2015',
        appPassphrase: 'secret',
      }),
    ).resolves.toEqual({ status: 'unsupported-signer' });
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });
});
