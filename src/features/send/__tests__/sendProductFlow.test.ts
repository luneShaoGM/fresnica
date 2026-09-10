import type { AccountRecord } from '../../../capabilities/account/types';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { PaymentReview } from '../../../capabilities/payment/buildPaymentReview';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type { PendingSubmissionRepository } from '../../../capabilities/transaction/pendingSubmission';
import {
  submitSendReview,
  validateDestination,
  validateStellarAmount,
  validateTextMemo,
  type SendProductDependencies,
} from '../sendProductFlow';

const TEST_NETWORK = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const accountAddress = 'GACCOUNT';
const destinationAddress = 'GDESTINATION';
const otherSourceAddress = 'GOTHERSOURCE';

function account(): AccountRecord {
  const now = new Date('2026-08-31T00:00:00.000Z');
  return {
    id: 'account-a',
    address: accountAddress,
    identityKind: 'classic',
    networkId: TEST_NETWORK.id,
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function review(source = accountAddress): PaymentReview {
  return Object.freeze({
    transactionXdrBase64: `payment-xdr:${source}`,
    networkId: TEST_NETWORK.id,
    source,
    operation: 'payment',
    destination: destinationAddress,
    amount: '1.0000000',
    asset: Object.freeze({ kind: 'native' as const }),
    fee: '100',
  });
}

function gateway(): SendProductDependencies['gateway'] {
  return {
    isClassicAccountAddress: jest.fn(address => address.startsWith('G')),
    inspectPaymentTransaction: jest.fn(input => {
      const source = input.transactionXdrBase64.split(':')[1] ?? accountAddress;
      return {
        source,
        fee: '100',
        operation: 'payment' as const,
        destination: destinationAddress,
        amount: '1.0000000',
        asset: { kind: 'native' as const },
      };
    }),
  } as unknown as SendProductDependencies['gateway'];
}

function dependencies(repository: InMemoryAccountSignerRepository): SendProductDependencies {
  return {
    repository,
    recovery: recovery(),
    gateway: gateway(),
    sdk: {} as FresnicaSdkPort,
    network: TEST_NETWORK,
  };
}

function recovery() {
  const repository = {
    create: jest.fn(),
    get: jest.fn(),
    findBlockingIntent: jest.fn(),
    listUnresolved: jest.fn().mockReturnValue([]),
    markUncertain: jest.fn(),
    markConfirmed: jest.fn(),
    markRejected: jest.fn(),
    markStillUnknown: jest.fn(),
  } satisfies jest.Mocked<PendingSubmissionRepository>;
  return {
    repository,
    readInvalidation: {invalidate: jest.fn()},
    now: () => new Date('2026-09-10T02:00:00.000Z'),
  };
}

describe('sendProductFlow', () => {
  it('accepts Classic G destinations and trims address whitespace', () => {
    const deps = dependencies(new InMemoryAccountSignerRepository());
    expect(validateDestination(deps, ` ${destinationAddress} `)).toBe(destinationAddress);
  });

  it('rejects muxed M and invalid destinations until the shared Payment contract expands', () => {
    const deps = dependencies(new InMemoryAccountSignerRepository());
    expect(() => validateDestination(deps, 'MDESTINATION')).toThrow('invalid-stellar-destination');
    expect(() => validateDestination(deps, 'not-a-stellar-address')).toThrow('invalid-stellar-destination');
  });

  it('preserves exact decimal strings up to seven places', () => {
    expect(validateStellarAmount('12.3456789')).toBe('12.3456789');
    expect(validateStellarAmount('1')).toBe('1');
  });

  it('rejects zero, excessive precision and values outside Stellar int64 amount range', () => {
    expect(() => validateStellarAmount('0')).toThrow('invalid-stellar-amount');
    expect(() => validateStellarAmount('1.00000001')).toThrow('invalid-stellar-amount');
    expect(() => validateStellarAmount('922337203685.4775808')).toThrow('invalid-stellar-amount');
  });

  it('validates text memo size in UTF-8 bytes and preserves semantic whitespace', () => {
    expect(validateTextMemo('测试测试测试')).toBe('测试测试测试');
    expect(validateTextMemo(' memo ')).toBe(' memo ');
    expect(() => validateTextMemo('测试测试测试测试测试')).toThrow('payment-memo-too-long');
  });

  it('fails closed before signing for a watch-only account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    repository.createAccount(account());
    await expect(submitSendReview(dependencies(repository), account(), review())).resolves.toEqual({
      status: 'watch-only',
    });
  });

  it('fails closed when multiple account signers are attached in v1', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    const now = new Date('2026-08-31T00:00:00.000Z');
    repository.createAccount(source);

    for (const id of ['one', 'two']) {
      repository.createSigner({
        id,
        publicKey: id === 'one' ? 'GSIGNERONE' : 'GSIGNERTWO',
        kind: 'protected-software',
        envelopeJson: '{}',
        createdAt: now,
        updatedAt: now,
      });
      repository.attachSigner(source.id, id, now);
    }

    await expect(submitSendReview(dependencies(repository), source, review())).resolves.toEqual({
      status: 'unsupported-account-signers',
    });
  });

  it('re-derives review semantics from exact XDR instead of trusting mutable fields', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);
    const exactReview = review();

    await expect(
      submitSendReview(dependencies(repository), source, {
        ...exactReview,
        source: otherSourceAddress,
        destination: otherSourceAddress,
        amount: '999.0000000',
      }),
    ).resolves.toEqual({ status: 'watch-only' });
  });

  it('rejects exact XDR whose source belongs to another account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(submitSendReview(dependencies(repository), source, review(otherSourceAddress))).rejects.toThrow(
      'send-review-account-mismatch',
    );
  });
});
