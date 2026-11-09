import { createHorizonClaimableGateway } from '../HorizonClaimableGateway';

const address = 'G' + 'A'.repeat(55);
const issuer = 'G' + 'B'.repeat(55);
const id = '00000000' + 'a'.repeat(64);
const endpoint = 'https://horizon-testnet.stellar.org';
const row = {
  id,
  amount: '3.0000000',
  asset: 'native',
  sponsor: issuer,
  paging_token: '100',
  claimants: [{ destination: address, predicate: { unconditional: true } }],
};

describe('S11 public Horizon Claimable gateway', () => {
  it('queries current claimant with bounded paging without trusting another account', async () => {
    const http = jest.fn(
      async (_url: string) => new Response(JSON.stringify({ _embedded: { records: [row] } }), { status: 200 }),
    );
    const reader = createHorizonClaimableGateway(http as unknown as typeof fetch);
    const result = await reader.page(endpoint, address, undefined, new AbortController().signal);
    expect(result.records[0]).toMatchObject({ id, claimant: address, amount: '3.0000000' });
    expect(http.mock.calls[0]?.[0]).toContain('claimant=' + address);
    expect(http.mock.calls[0]?.[0]).toContain('limit=50');
    expect(result.nextCursor).toBeUndefined();
  });

  it('rejects mixed-page wrong claimant instead of persisting partial records', async () => {
    const http = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            _embedded: {
              records: [
                row,
                {
                  ...row,
                  id: '00000000' + 'b'.repeat(64),
                  claimants: [{ destination: issuer, predicate: { unconditional: true } }],
                },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    await expect(
      createHorizonClaimableGateway(http as unknown as typeof fetch).page(
        endpoint,
        address,
        undefined,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'protocol' });
  });

  it('rejects a full page without a valid cursor', async () => {
    const records = Array.from({ length: 50 }, (_, i) => ({
      ...row,
      id: '00000000' + i.toString(16).padStart(64, '0'),
      paging_token: '',
    }));
    const http = jest.fn(
      async (_url: string) => new Response(JSON.stringify({ _embedded: { records } }), { status: 200 }),
    );
    await expect(
      createHorizonClaimableGateway(http as unknown as typeof fetch).page(
        endpoint,
        address,
        undefined,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'protocol' });
  });

  it('only returns the same exact live claimable ID for the current claimant', async () => {
    const http = jest.fn(async (_url: string) => new Response(JSON.stringify(row), { status: 200 }));
    const reader = createHorizonClaimableGateway(http as unknown as typeof fetch);
    expect((await reader.byId(endpoint, id, address, new AbortController().signal))?.id).toBe(id);
    expect(http.mock.calls[0]?.[0]).toBe(endpoint + '/claimable_balances/' + id);
    const wrong = jest.fn(
      async () => new Response(JSON.stringify({ ...row, id: '00000000' + 'b'.repeat(64) }), { status: 200 }),
    );
    await expect(
      createHorizonClaimableGateway(wrong as unknown as typeof fetch).byId(
        endpoint,
        id,
        address,
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'protocol' });
  });

  it('rejects invalid account/cursor/ID locally and treats 404 as missing for current-by-ID', async () => {
    const http = jest.fn(async (_url: string) => new Response('', { status: 404 }));
    const reader = createHorizonClaimableGateway(http as unknown as typeof fetch);
    await expect(reader.page(endpoint, address, 'bad cursor', new AbortController().signal)).rejects.toMatchObject({
      kind: 'request',
    });
    await expect(reader.byId(endpoint, 'not-id', address, new AbortController().signal)).rejects.toMatchObject({
      kind: 'request',
    });
    await expect(reader.byId(endpoint, id, address, new AbortController().signal)).resolves.toBeUndefined();
    expect(http).toHaveBeenCalledTimes(1);
  });
});
