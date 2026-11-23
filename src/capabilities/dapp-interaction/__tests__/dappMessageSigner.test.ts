import { createHash, generateKeyPairSync, sign as signBytes, verify } from 'node:crypto';

import { createFreighterSession } from '../freighterSession';
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

it('verifies signatures for official raw text and explicitly encoded Stellar UTF-8 bytes', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const address = account.address;
  const selection = {
    accountId: account.id,
    address,
    networkId: account.networkId,
    revision: 1,
    networkPassphrase: 'Test SDF Network ; September 2015',
    networkUrl: 'https://example.org',
  };
  const origin = 'https://example.org';
  const session = createFreighterSession({
    origin,
    token: 'test',
    initial: selection,
    current: () => selection,
    persistedAllowed: () => true,
  });
  const send = (messageId: number, blob: string, blobEncoding?: string) =>
    session.receive(
      JSON.stringify({
        source: 'FREIGHTER_EXTERNAL_MSG_REQUEST',
        type: 'SUBMIT_BLOB',
        apiVersion: '6.0.1',
        messageId,
        blob,
        blobEncoding,
      }),
      origin,
    );
  const hash = (bytes: Buffer) => createHash('sha256').update('Stellar Signed Message:\n').update(bytes).digest();
  const sdk = {
    signMessageWithPassphrase: jest.fn(async ({ message }: { message: string }) =>
      signBytes(null, hash(Buffer.from(message, 'utf8')), privateKey).toString('base64'),
    ),
  };
  const sign = createDappMessageSigner(sdk, {
    getAccount: () => ({ ...account, address }),
    listSignersForAccount: () => [{ ...signer, publicKey: address }],
  });
  const raw = '  café\n✓ ';
  const base64 = Buffer.from(raw, 'utf8').toString('base64');
  for (const [id, blobEncoding, expected] of [
    [1, undefined, base64],
    [2, 'base64', raw],
  ] as const) {
    const request = send(id, base64, blobEncoding);
    expect(request).toMatchObject({ kind: 'sign-message', message: expected });
    if (request.kind !== 'sign-message') throw new Error('expected review');
    const signature = await sign({
      accountId: account.id,
      accountAddress: address,
      networkId: account.networkId,
      message: request.message,
      encoding: request.encoding,
      appPassphrase: 'fresh',
      isCurrent: session.canSignMessage,
    });
    const response = session.finishSign({
      status: 'message-signed',
      signedBlob: signature ?? '',
      signerAddress: address,
    });
    const returned = Buffer.from(response?.signedBlob ?? '', 'base64');
    expect(verify(null, hash(Buffer.from(expected)), publicKey, returned)).toBe(true);
    expect(verify(null, hash(Buffer.from(id === 1 ? raw : base64)), publicKey, returned)).toBe(false);
  }
  expect(send(3, '/w==', 'base64')).toMatchObject({ response: { error: 'invalid-message' } });
  expect(send(4, 'YQ', 'base64')).toMatchObject({ response: { error: 'invalid-message' } });
  expect(send(5, Buffer.from('x'.repeat(4097)).toString('base64'), 'base64')).toMatchObject({
    response: { error: 'invalid-message' },
  });
});
