import { authorizeExistingWalletProtection } from '../existingWalletProtection';
type Dependencies = Parameters<typeof authorizeExistingWalletProtection>[0];
function fixture(existing = false) {
  const verify = jest.fn(async () => true);
  const dependencies = {
    repository: {
      listSigners: () =>
        existing ? [{ kind: 'protected-software', publicKey: 'GFAKE', envelopeJson: 'old-envelope' }] : [],
    },
    sdk: { verifyProtectedSignerPassphrase: verify },
  } as unknown as Dependencies;
  return { dependencies, verify };
}
it('blocks weak new passwords even with risk acceptance and requires acceptance for a short phrase', async () => {
  const { dependencies, verify } = fixture();
  await expect(authorizeExistingWalletProtection(dependencies, 'river sky', 'river sky')).rejects.toThrow(
    'app-passphrase-short-risk-required',
  );
  await expect(
    authorizeExistingWalletProtection(dependencies, 'river sky', 'river sky', true),
  ).resolves.toBeUndefined();
  await expect(
    authorizeExistingWalletProtection(dependencies, '111111111111111', '111111111111111', true),
  ).rejects.toThrow('app-passphrase-numeric-only');
  expect(verify).not.toHaveBeenCalled();
});
it('verifies a legacy numeric password exactly without applying new-protection rules', async () => {
  const { dependencies, verify } = fixture(true);
  await expect(authorizeExistingWalletProtection(dependencies, '1234')).resolves.toBeUndefined();
  expect(verify).toHaveBeenCalledWith({
    envelopeJson: 'old-envelope',
    expectedSignerPublicKey: 'GFAKE',
    appPassphrase: '1234',
  });
});
