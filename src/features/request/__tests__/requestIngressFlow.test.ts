import type { RequestIngressPort } from '../../../capabilities/request/RequestIngressPort';
import { PUBLIC_NETWORK_PASSPHRASE } from '../../../capabilities/request/requestUri';
import { createRequestScanFrameGate, parseRequestIngress, resolveRequestCameraAccess } from '../requestIngressFlow';

const currentNetwork = Object.freeze({ id: 'stellar-mainnet', networkPassphrase: PUBLIC_NETWORK_PASSPHRASE });
const dependencies = {
  currentNetwork,
  isClassicAccountAddress: (value: string) => value.startsWith('G'),
};

function ingress(overrides: Partial<RequestIngressPort> = {}): RequestIngressPort {
  return {
    readClipboardText: jest.fn().mockResolvedValue(''),
    checkCameraPermission: jest.fn().mockResolvedValue('granted'),
    requestCameraPermission: jest.fn().mockResolvedValue('granted'),
    openCameraSettings: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('request ingress flow', () => {
  it('uses the same typed parser for paste and scan carriers', () => {
    const raw = 'GDESTINATION';
    const pasted = parseRequestIngress(dependencies, 'paste', raw);
    const scanned = parseRequestIngress(dependencies, 'scan', raw);

    expect(pasted.result).toEqual(scanned.result);
    expect(pasted.diagnostics).toEqual({ carrier: 'paste', outcome: 'accepted', category: 'payment-request' });
    expect(scanned.diagnostics).toEqual({ carrier: 'scan', outcome: 'accepted', category: 'payment-request' });
  });

  it('never retains raw secret, malformed URI, or unknown parameter content in rejected results or diagnostics', () => {
    const secret = `S${'A'.repeat(55)}`;
    const cases = [
      secret,
      'web+stellar:pay?destination=%E0%A4%A',
      `web+stellar:pay?destination=GDESTINATION&unknown=${encodeURIComponent(secret)}`,
    ];

    for (const raw of cases) {
      const parsed = parseRequestIngress(dependencies, 'paste', raw);
      const serialized = JSON.stringify(parsed);
      expect(parsed.result.status).not.toBe('accepted');
      expect(serialized).not.toContain(raw);
      expect(serialized).not.toContain(secret);
    }
  });

  it('locks duplicate scan frame callbacks until retry resets the gate', () => {
    const gate = createRequestScanFrameGate();
    expect(gate.accept()).toBe(true);
    expect(gate.accept()).toBe(false);
    expect(gate.accept()).toBe(false);
    gate.reset();
    expect(gate.accept()).toBe(true);
  });

  it('does not request camera permission when access is already granted', async () => {
    const port = ingress({ checkCameraPermission: jest.fn().mockResolvedValue('granted') });
    await expect(resolveRequestCameraAccess(port)).resolves.toBe('granted');
    expect(port.requestCameraPermission).not.toHaveBeenCalled();
  });

  it('requests camera permission only from the requestable denied state', async () => {
    const port = ingress({
      checkCameraPermission: jest.fn().mockResolvedValue('denied'),
      requestCameraPermission: jest.fn().mockResolvedValue('blocked'),
    });
    await expect(resolveRequestCameraAccess(port)).resolves.toBe('blocked');
    expect(port.requestCameraPermission).toHaveBeenCalledTimes(1);
  });

  it.each(['blocked', 'unavailable'] as const)('keeps %s camera access stable without prompting again', async state => {
    const port = ingress({ checkCameraPermission: jest.fn().mockResolvedValue(state) });
    await expect(resolveRequestCameraAccess(port)).resolves.toBe(state);
    expect(port.requestCameraPermission).not.toHaveBeenCalled();
  });
});
