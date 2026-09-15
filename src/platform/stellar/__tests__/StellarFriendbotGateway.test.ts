import { StellarFriendbotGateway, type FriendbotHttpClient } from '../StellarFriendbotGateway';

describe('StellarFriendbotGateway', () => {
  it('sends only the public address to the configured Friendbot endpoint', async () => {
    const httpClient = jest
      .fn<ReturnType<FriendbotHttpClient>, Parameters<FriendbotHttpClient>>()
      .mockResolvedValue({ ok: true, status: 200 });
    const gateway = new StellarFriendbotGateway('https://friendbot.stellar.org', httpClient);

    await gateway.fundAccount('GABC+TEST');

    expect(httpClient).toHaveBeenCalledWith('https://friendbot.stellar.org?addr=GABC%2BTEST');
  });

  it('fails without trusting a non-success response body', async () => {
    const httpClient = jest
      .fn<ReturnType<FriendbotHttpClient>, Parameters<FriendbotHttpClient>>()
      .mockResolvedValue({ ok: false, status: 429 });
    const gateway = new StellarFriendbotGateway('https://friendbot.stellar.org', httpClient);

    await expect(gateway.fundAccount('GACCOUNT')).rejects.toThrow('friendbot-http-error:429');
  });
});
