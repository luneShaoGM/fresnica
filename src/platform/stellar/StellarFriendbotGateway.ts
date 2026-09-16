import type { FriendbotGatewayPort } from '../../capabilities/network/FriendbotGateway';

type FriendbotHttpResponse = Readonly<{
  ok: boolean;
  status: number;
}>;

export type FriendbotHttpClient = (url: string) => Promise<FriendbotHttpResponse>;

const defaultHttpClient: FriendbotHttpClient = async url => {
  const response = await fetch(url);
  return { ok: response.ok, status: response.status };
};

export class StellarFriendbotGateway implements FriendbotGatewayPort {
  constructor(
    private readonly endpoint: string,
    private readonly httpClient: FriendbotHttpClient = defaultHttpClient,
  ) {}

  async fundAccount(address: string): Promise<void> {
    const response = await this.httpClient(`${this.endpoint}?addr=${encodeURIComponent(address)}`);
    if (!response.ok) {
      throw new Error(`friendbot-http-error:${response.status}`);
    }
  }
}
