import type { NetworkContext } from '../../capabilities/network/types';
import type { RequestCameraPermissionState, RequestIngressPort } from '../../capabilities/request/RequestIngressPort';
import { parseRequestInput, type RequestParseResult } from '../../capabilities/request/requestUri';
import { normalizeUntrustedDappUrl } from '@capabilities/dapp-interaction/externalDappUrl';

export type RequestIngressCarrier = 'paste' | 'scan';

export type RequestIngressParseDependencies = Readonly<{
  currentNetwork: NetworkContext;
  isClassicAccountAddress(address: string): boolean;
}>;

export type RequestIngressResult = Readonly<{
  carrier: RequestIngressCarrier;
  result: RequestParseResult;
  diagnostics: Readonly<{
    carrier: RequestIngressCarrier;
    outcome: RequestParseResult['diagnostics']['outcome'];
    category: RequestParseResult['diagnostics']['category'];
  }>;
}>;

export function parseRequestIngress(
  dependencies: RequestIngressParseDependencies,
  carrier: RequestIngressCarrier,
  rawInput: string,
): RequestIngressResult {
  const result = parseRequestInput(
    {
      currentNetwork: dependencies.currentNetwork,
      isClassicAccountAddress: dependencies.isClassicAccountAddress,
    },
    rawInput,
  );

  return Object.freeze({
    carrier,
    result,
    diagnostics: Object.freeze({
      carrier,
      outcome: result.diagnostics.outcome,
      category: result.diagnostics.category,
    }),
  });
}

export function classifyGeneralRequestScan(dependencies: RequestIngressParseDependencies, rawInput: string) {
  const ingress = parseRequestIngress(dependencies, 'scan', rawInput);
  if (ingress.result.status === 'rejected' && ingress.result.reason === 'sensitive-input') {
    return { kind: 'request', ingress } as const;
  }
  if (/^https:\/\//i.test(rawInput.trim())) {
    try {
      const decoded = parseRequestIngress(dependencies, 'scan', decodeURIComponent(rawInput));
      if (decoded.result.status === 'rejected' && decoded.result.reason === 'sensitive-input') {
        return { kind: 'request', ingress: decoded } as const;
      }
      return { kind: 'website', url: normalizeUntrustedDappUrl(rawInput).url } as const;
    } catch {
      // Unsafe URLs retain the strict Request rejection without retaining raw input.
    }
  }
  return { kind: 'request', ingress } as const;
}

export async function resolveRequestCameraAccess(
  ingress: Pick<RequestIngressPort, 'checkCameraPermission' | 'requestCameraPermission'>,
): Promise<RequestCameraPermissionState> {
  const current = await ingress.checkCameraPermission();
  return current === 'denied' ? ingress.requestCameraPermission() : current;
}

export type RequestScanFrameGate = Readonly<{
  accept(): boolean;
  reset(): void;
}>;

export function createRequestScanFrameGate(): RequestScanFrameGate {
  let locked = false;
  return {
    accept() {
      if (locked) return false;
      locked = true;
      return true;
    },
    reset() {
      locked = false;
    },
  };
}
