import {SessionLogger, redactDiagnosticValue} from '../SessionLogger';

const SECRET = `S${'A'.repeat(55)}`;

describe('SessionLogger', () => {
  it('redacts sensitive fields recursively before buffering or export', () => {
    const logger = new SessionLogger({now: () => new Date('2026-09-09T00:00:00.000Z')});
    logger.info('signing-review', {
      details: {
        passphrase: 'correct horse battery staple',
        transactionXdrBase64: 'AAAA-sensitive-xdr',
        nested: {envelopeJson: '{opaque}', fcmToken: 'token-value'},
      },
    });

    const exported = logger.exportSession();
    expect(exported).not.toContain('correct horse battery staple');
    expect(exported).not.toContain('AAAA-sensitive-xdr');
    expect(exported).not.toContain('{opaque}');
    expect(exported).not.toContain('token-value');
    expect(exported).toContain('[REDACTED]');
  });

  it('redacts a Stellar secret embedded in otherwise safe text', () => {
    expect(redactDiagnosticValue(`failure for ${SECRET}`)).toBe('failure for [REDACTED]');
  });
  it('keeps caller correlation ids and trims the oldest entries', () => {
    const logger = new SessionLogger({
      now: () => new Date('2026-09-09T00:00:00.000Z'),
      maxEntries: 2,
    });
    const correlationId = logger.createCorrelationId('send');

    logger.info('one', {correlationId});
    logger.warn('two', {correlationId});
    logger.error('three', {correlationId});

    expect(logger.entries()).toHaveLength(2);
    expect(logger.entries().map(entry => entry.event)).toEqual(['two', 'three']);
    expect(logger.entries().every(entry => entry.correlationId === correlationId)).toBe(true);
  });

  it('sanitizes Error messages and preserves non-sensitive codes', () => {
    const error = Object.assign(new Error(`bad secret ${SECRET}`), {code: 'identity-mismatch'});
    expect(redactDiagnosticValue(error)).toEqual({
      name: 'Error',
      message: 'bad secret [REDACTED]',
      code: 'identity-mismatch',
    });
  });
});
