import { horizonHttpError, horizonReadJson } from './horizonReadHttp';
import { NodeReadError } from '../../capabilities/network/NodeReadError';
import type { AccountEffectsPort, EffectStreamFailure } from '../../capabilities/account-sync/AccountEffects';

const MAX_RESPONSE = 512 * 1024;
const MAX_EVENT = 32 * 1024;

// XHR incremental progress works on RN without requiring Node EventSource/fetch streams.
// Reconnect ownership belongs to App; this adapter opens exactly one bounded connection.
export function createHorizonAccountEffects(
  horizonUrl: string,
  createRequest: () => XMLHttpRequest = () => new XMLHttpRequest(),
  http: typeof fetch = fetch,
): AccountEffectsPort {
  const endpoint = (address: string) =>
    `${horizonUrl.replace(/\/$/, '')}/accounts/${encodeURIComponent(address)}/effects`;
  return {
    open(input) {
      const xhr = createRequest();
      let stopped = false;
      let opened = false;
      let consumed = 0;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        xhr.abort();
      };
      const fail = (reason: EffectStreamFailure, failure?: NodeReadError) => {
        if (stopped) return;
        stop();
        if (failure) input.onFailure(reason, failure);
        else input.onFailure(reason);
      };
      const parse = createEffectEventParser(token => {
        if (!stopped) input.onEffect(token);
      });
      const progress = () => {
        if (stopped || xhr.readyState < 2) return;
        if (!opened) {
          if (xhr.status !== 200) {
            fail(
              xhr.status === 400 || xhr.status === 410 ? 'cursor-rejected' : 'failed',
              xhr.status === 429 || xhr.status >= 500
                ? horizonHttpError(xhr.status, xhr.getResponseHeader('Retry-After'))
                : undefined,
            );
            return;
          }
          if (!/^text\/event-stream(?:;|$)/i.test(xhr.getResponseHeader('content-type') ?? '')) {
            fail('failed');
            return;
          }
          opened = true;
          input.onOpen();
          if (stopped) return;
        }
        try {
          const response = xhr.responseText;
          // Rotate before unbounded native/JS cumulative response growth.
          if (response.length > MAX_RESPONSE) {
            fail('rotate');
            return;
          }
          parse(response.slice(consumed));
          consumed = response.length;
        } catch {
          fail('failed');
        }
      };
      try {
        xhr.open('GET', `${endpoint(input.address)}?cursor=${encodeURIComponent(input.cursor ?? 'now')}&order=asc`);
        xhr.setRequestHeader('Accept', 'text/event-stream');
        xhr.onreadystatechange = progress;
        xhr.onprogress = progress;
        xhr.onerror = () => fail('failed');
        xhr.ontimeout = () => fail('failed');
        xhr.onload = () => {
          progress();
          fail('failed');
        };
        xhr.send();
      } catch {
        stop();
        throw new Error('effects-stream-open-failed');
      }
      return stop;
    },
    async latest(address, signal) {
      const body = await horizonReadJson(`${endpoint(address)}?order=desc&limit=1`, signal, http);
      if (signal.aborted) throw new NodeReadError('superseded');
      // An unfunded classic account has no effects yet; polling must keep running.
      if (body === undefined) return undefined;
      const records = (body as { _embedded?: { records?: unknown } } | null)?._embedded?.records;
      if (!Array.isArray(records) || records.length > 1) throw new NodeReadError('protocol');
      if (records.length === 0) return undefined;
      return effectToken(records[0]);
    },
  };
}

function effectToken(value: unknown): string {
  const token = (value as { paging_token?: unknown } | null)?.paging_token;
  if (typeof token !== 'string' || token.length === 0 || token.length > 256 || /[\r\n\0]/.test(token)) {
    throw new NodeReadError('protocol');
  }
  return token;
}

// The SSE id and paging_token remain opaque strings (including values beyond JS integer precision).
export function createEffectEventParser(onEffect: (token: string) => void): (chunk: string) => void {
  let buffer = '';
  let data: string[] = [];
  let event = '';
  let size = 0;
  let first = true;
  let skipLF = false;
  return chunk => {
    if (chunk.length === 0) return;
    if (skipLF) {
      chunk = chunk.replace(/^\n/, '');
      skipLF = false;
    }
    if (first && chunk.length > 0) {
      first = false;
      chunk = chunk.replace(/^\uFEFF/, '');
    }
    buffer += chunk;
    for (;;) {
      const match = /\r\n|\r|\n/.exec(buffer);
      if (!match) break;
      skipLF = match[0] === '\r' && match.index === buffer.length - 1;
      const line = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      size += line.length;
      if (size > MAX_EVENT) throw new Error('effects-event-too-large');
      if (line === '') {
        if (event === 'close' || event === 'error') throw new Error('effects-stream-ended');
        if (data.length && (event === '' || event === 'message')) onEffect(effectToken(JSON.parse(data.join('\n'))));
        data = [];
        event = '';
        size = 0;
      } else if (!line.startsWith(':')) {
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'data') data.push(value);
        if (field === 'event') event = value;
      }
    }
    if (buffer.length + size > MAX_EVENT) throw new Error('effects-event-too-large');
  };
}
