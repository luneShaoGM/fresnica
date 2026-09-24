import type { NetworkContext } from '../../capabilities/network/types';
import type { RequestCameraPermissionState, RequestIngressPort } from '../../capabilities/request/RequestIngressPort';
import { parseRequestInput, type RequestParseResult } from '../../capabilities/request/requestUri';

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
