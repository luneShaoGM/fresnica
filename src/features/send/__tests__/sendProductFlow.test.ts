import {StrKey} from '@stellar/stellar-sdk';

import type {AccountRecord} from '../../../capabilities/account/types';
import type {PaymentReview} from '../../../capabilities/payment/buildPaymentReview';
import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type {StellarGateway} from '../../../platform/stellar/StellarGateway';
import {
  submitSendReview,
  validateDestination,
  validateStellarAmount,
  type SendProductDependencies,
} from '../sendProductFlow';

const accountAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const destinationAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));

function account(): AccountRecord {
  const now = new Date('2026-08-31T00:00:00.000Z');
  return {
    id: 'account-a',
    address: accountAddress,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function review(): PaymentReview {
  return {
    transactionXdrBase64: 'not-used-before-signer-gate',
    networkId: 'stellar-testnet',
    source: accountAddress,
    destination: destinationAddress,
    amount: '1.0000000',
    asset: {kind: 'native'},
    fee: '100',
    expiresAtUnixSeconds: 2_000_000_000,
  };
}

function dependencies(repository: InMemoryAccountSignerRepository): SendProductDependencies {
  return {
    repository,
    gateway: {} as StellarGateway,
    sdk: {} as FresnicaSdk,
  };
}

describe('sendProductFlow', () => {
  it('accepts valid G and M destinations and trims whitespace', () => {
    const muxed = StrKey.encodeMed25519PublicKey(new Uint8Array(40).fill(3));

    expect(validateDestination(` ${destinationAddress} `)).toBe(destinationAddress);
    expect(validateDestination(muxed)).toBe(muxed);
  });

  it('rejects invalid destination identities', () => {
    expect(() => validateDestination('not-a-stellar-address')).toThrow(
      'invalid-stellar-destination',
    );
  });

  it('preserves exact decimal strings up to seven places', () => {
    expect(validateStellarAmount('12.3456789')).toBe('12.3456789');
    expect(validateStellarAmount('1')).toBe('1');
  });

  it('rejects zero, excessive precision and values outside Stellar int64 amount range', () => {
    expect(() => validateStellarAmount('0')).toThrow('invalid-stellar-amount');
    expect(() => validateStellarAmount('1.00000001')).toThrow('invalid-stellar-amount');
    expect(() => validateStellarAmount('922337203685.4775808')).toThrow(
      'invalid-stellar-amount',
    );
  });

  it('fails closed before signing for a watch-only account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account());

    await expect(
      submitSendReview(dependencies(repository), account(), review()),
    ).resolves.toEqual({status: 'watch-only'});
  });

  it('fails closed when multiple account signers are attached in v1', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    const now = new Date('2026-08-31T00:00:00.000Z');
    repository.createAccount(source);

    for (const id of ['one', 'two']) {
      repository.createSigner({
        id,
        publicKey: StrKey.encodeEd25519PublicKey(
          new Uint8Array(32).fill(id === 'one' ? 4 : 5),
        ),
        kind: 'protected-software',
        envelopeJson: '{}',
        createdAt: now,
        updatedAt: now,
      });
      repository.attachSigner(source.id, id, now);
    }

    await expect(
      submitSendReview(dependencies(repository), source, review()),
    ).resolves.toEqual({status: 'unsupported-account-signers'});
  });

  it('rejects a review that belongs to another source account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(
      submitSendReview(dependencies(repository), source, {
        ...review(),
        source: destinationAddress,
      }),
    ).rejects.toThrow('send-review-account-mismatch');
  });
});
