import { NodeReadError } from '../../capabilities/network/NodeReadError';

export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | undefined {
  if (!value || value.length > 128) return undefined;
  const text = value.trim();
  const delay = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text) - now;
  return Number.isFinite(delay) && delay >= 0 && delay <= Number.MAX_SAFE_INTEGER / 2 ? delay : undefined;
}
export function horizonHttpError(status: number, retryAfter: string | null): NodeReadError {
  return new NodeReadError(
    status === 429 ? 'rate-limited' : status >= 500 ? 'unavailable' : 'request',
    retryAfterMilliseconds(retryAfter),
  );
}
export async function horizonReadJson(url: string, signal: AbortSignal, http: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await http(url, { signal });
  } catch {
    throw new NodeReadError(signal.aborted ? 'superseded' : 'unavailable');
  }
  if (response.status === 404) return undefined;
  if (!response.ok) throw horizonHttpError(response.status, response.headers.get('Retry-After'));
  try {
    return await response.json();
  } catch {
    throw new NodeReadError(signal.aborted ? 'superseded' : 'protocol');
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeReadError('protocol');
  return value as Record<string, unknown>;
}
