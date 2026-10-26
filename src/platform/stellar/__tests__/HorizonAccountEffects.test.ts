import { createEffectEventParser, createHorizonAccountEffects } from '../HorizonAccountEffects';

function fakeRequest() {
  return {
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    abort: jest.fn(),
    send: jest.fn(),
    getResponseHeader: jest.fn(() => 'text/event-stream; charset=utf-8'),
    readyState: 1,
    status: 200,
    responseText: '',
    onreadystatechange: () => {},
    onprogress: () => {},
    onerror: () => {},
    ontimeout: () => {},
    onload: () => {},
  };
}
function setup() {
  const xhr = fakeRequest();
  const http = jest.fn();
  const gateway = createHorizonAccountEffects('https://horizon.test/', () => xhr as unknown as XMLHttpRequest, http);
  const onOpen = jest.fn();
  const onEffect = jest.fn();
  const onFailure = jest.fn();
  const stop = gateway.open({ address: 'G+ACCOUNT', cursor: 'opaque:9007199254740993', onOpen, onEffect, onFailure });
  return { xhr, http, gateway, onOpen, onEffect, onFailure, stop };
}
describe('Horizon Effects SSE adapter', () => {
  it('opens one encoded account stream and emits only normalized opaque tokens from incremental response text', () => {
    const s = setup();
    expect(s.xhr.open).toHaveBeenCalledWith(
      'GET',
      'https://horizon.test/accounts/G%2BACCOUNT/effects?cursor=opaque%3A9007199254740993&order=asc',
    );
    expect(s.xhr.setRequestHeader).toHaveBeenCalledWith('Accept', 'text/event-stream');
    s.xhr.readyState = 2;
    s.xhr.onreadystatechange();
    expect(s.onOpen).toHaveBeenCalledTimes(1);
    s.xhr.readyState = 3;
    s.xhr.responseText = 'data: {"paging_token":"9007199254740993"';
    s.xhr.onprogress();
    expect(s.onEffect).not.toHaveBeenCalled();
    s.xhr.responseText += '}\n\n';
    s.xhr.onprogress();
    s.xhr.onprogress();
    expect(s.onEffect.mock.calls).toEqual([['9007199254740993']]);
    s.stop();
    s.stop();
    s.xhr.onerror();
    expect(s.xhr.abort).toHaveBeenCalledTimes(1);
    expect(s.onFailure).not.toHaveBeenCalled();
  });
  it.each([400, 410, 404, 429, 500])('reports HTTP %s once and leaves retry ownership to App', status => {
    const s = setup();
    s.xhr.status = status;
    s.xhr.readyState = 2;
    s.xhr.onreadystatechange();
    s.xhr.onerror();
    expect(s.onOpen).not.toHaveBeenCalled();
    expect(s.onFailure.mock.calls[0][0]).toBe(status === 400 || status === 410 ? 'cursor-rejected' : 'failed');
    expect(s.onFailure).toHaveBeenCalledTimes(1);
    if (status === 429 || status >= 500)
      expect(s.onFailure.mock.calls[0][1]).toMatchObject({ kind: status === 429 ? 'rate-limited' : 'unavailable' });
    expect(s.xhr.abort).toHaveBeenCalledTimes(1);
  });
  it('rejects non-SSE responses and malformed data without exposing raw payloads', () => {
    const s = setup();
    s.xhr.getResponseHeader.mockReturnValue('application/json');
    s.xhr.readyState = 2;
    s.xhr.onreadystatechange();
    expect(s.onFailure).toHaveBeenCalledWith('failed');
    const next = setup();
    next.xhr.readyState = 3;
    next.xhr.responseText = 'data: invalid json\n\n';
    next.xhr.onprogress();
    expect(next.onFailure).toHaveBeenCalledWith('failed');
    expect(next.onEffect).not.toHaveBeenCalled();
  });
  it('rotates bounded cumulative responses, handles EOF and ignores queued callbacks after stop', () => {
    const s = setup();
    s.xhr.readyState = 3;
    s.xhr.responseText = 'x'.repeat(512 * 1024 + 1);
    s.xhr.onprogress();
    expect(s.onFailure).toHaveBeenCalledWith('rotate');
    s.xhr.onload();
    expect(s.onFailure).toHaveBeenCalledTimes(1);
    const next = setup();
    next.xhr.readyState = 4;
    next.xhr.onload();
    expect(next.onFailure).toHaveBeenCalledWith('failed');
    const last = setup();
    last.stop();
    last.xhr.readyState = 2;
    last.xhr.onreadystatechange();
    expect(last.onOpen).not.toHaveBeenCalled();
  });
  it('uses now by default and aborts a request whose send throws', () => {
    const xhr = fakeRequest();
    xhr.send.mockImplementation(() => {
      throw new Error('unsupported');
    });
    const gateway = createHorizonAccountEffects('https://horizon.test', () => xhr as unknown as XMLHttpRequest);
    expect(() => gateway.open({ address: 'GA', onOpen: jest.fn(), onEffect: jest.fn(), onFailure: jest.fn() })).toThrow(
      'effects-stream-open-failed',
    );
    expect(xhr.open.mock.calls[0][1]).toContain('cursor=now');
    expect(xhr.abort).toHaveBeenCalledTimes(1);
  });
  it('checks latest effects with abort support, treats 404 as unfunded and validates records', async () => {
    const s = setup();
    const controller = new AbortController();
    s.http.mockResolvedValueOnce({ status: 404 });
    await expect(s.gateway.latest('G+ACCOUNT', controller.signal)).resolves.toBeUndefined();
    expect(s.http).toHaveBeenCalledWith('https://horizon.test/accounts/G%2BACCOUNT/effects?order=desc&limit=1', {
      signal: controller.signal,
    });
    s.http.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ _embedded: { records: [{ paging_token: 'opaque' }] } }),
    });
    await expect(s.gateway.latest('GA', controller.signal)).resolves.toBe('opaque');
    s.http.mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => '30' } });
    await expect(s.gateway.latest('GA', controller.signal)).rejects.toMatchObject({
      kind: 'rate-limited',
      retryAfterMs: 30000,
    });
    s.http.mockResolvedValueOnce({ ok: true, json: async () => ({ _embedded: { records: [{}] } }) });
    await expect(s.gateway.latest('GA', controller.signal)).rejects.toThrow('effects-invalid-token');
    s.stop();
  });
});
describe('bounded Effects event parser', () => {
  it('handles BOM, split CRLF, comments, custom open events, multiline data and arbitrary chunk boundaries', () => {
    const effect = jest.fn();
    const parse = createEffectEventParser(effect);
    const input =
      '\uFEFF: heartbeat\r\nevent: open\r\ndata: "hello"\r\n\r\nid: opaque\r\ndata: {\r\ndata: "paging_token":"token",\r\ndata: "ignored":"raw"}\r\n\r\n';
    for (const character of input) parse(character);
    expect(effect.mock.calls).toEqual([['token']]);
  });
  it('dispatches CR-only frames immediately and skips a later LF without duplicating a frame', () => {
    const effect = jest.fn();
    const parse = createEffectEventParser(effect);
    parse('data: {"paging_token":"one"}\r\r');
    expect(effect.mock.calls).toEqual([['one']]);
    parse('\n');
    parse('data: {"paging_token":"two"}\n\n');
    expect(effect.mock.calls).toEqual([['one'], ['two']]);
  });
  it.each([
    'data: {}\n\n',
    'data: {"paging_token":12}\n\n',
    'data: {"paging_token":""}\n\n',
    'event: close\ndata: "bye"\n\n',
    'x'.repeat(32769),
  ])('rejects invalid/bounded stream input %#', input => {
    expect(() => createEffectEventParser(jest.fn())(input)).toThrow();
  });
});
