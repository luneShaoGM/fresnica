export interface FriendbotGatewayPort {
  fundAccount(address: string): Promise<void>;
}
