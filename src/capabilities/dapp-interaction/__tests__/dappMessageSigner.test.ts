import { createDappMessageSigner } from '../dappMessageSigner';
import type { AccountRecord } from '../../account/types';
import type { SignerRecord } from '../../signer/types';

const account: AccountRecord = {
  id: 'wallet',
  address: 'GTEST',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  hidden: false,
  label: 'Test wallet',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const signer: SignerRecord = {
  id: 'signer',
  kind: 'protected-software',
  publicKey: account.address,
  envelopeJson: 'opaque-protected-envelope',
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
};

it('calls only the passphrase SDK with the exact message and drops a retired SDK result', async () => {
  const base64 = Buffer.alloc(64, 0xab).toString('base64');
  const sdk = { signMessageWithPassphrase: jest.fn(async () => base64) };
  const listSignersForAccount = jest.fn((): SignerRecord[] => [signer]);
  const sign = createDappMessageSigner(sdk, { getAccount: () => account, listSignersForAccount });
  let active = true;
  const input = {
    accountId: account.id,
    accountAddress: account.address,
    networkId: account.networkId,
    message: '  challenge café\n ',
    appPassphrase: 'new passphrase',
    encoding: 'hex' as const,
    isCurrent: () => active,
  };
  await expect(sign({ ...input, appPassphrase: '' })).resolves.toBeUndefined();
  await expect(sign({ ...input, networkId: 'wrong-network' })).resolves.toBeUndefined();
  listSignersForAccount.mockReturnValueOnce([]);
  await expect(sign(input)).resolves.toBeUndefined();
  expect(sdk.signMessageWithPassphrase).not.toHaveBeenCalled();
  await expect(sign(input)).resolves.toBe('ab'.repeat(64));
  expect(sdk.signMessageWithPassphrase).toHaveBeenCalledWith({
    envelopeJson: signer.envelopeJson,
    expectedSignerPublicKey: account.address,
    appPassphrase: input.appPassphrase,
    message: input.message,
  });
  await expect(sign({ ...input, encoding: 'base64' })).resolves.toBe(base64);
  const pending = sign(input);
  active = false;
  await expect(pending).resolves.toBeUndefined();
});
