import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  StrKey,
  TransactionBuilder,
  type xdr,
} from '@stellar/stellar-sdk';
import {
  validContractBaseUnits,
  validContractMetadata,
  type ContractTokenRead,
  type ContractTokenReadPort,
} from '@capabilities/assets/contractAssets';
import { NETWORKS } from '@capabilities/network/networkPreferences';
import { SOROBAN_RPC_URLS } from '@capabilities/network/sorobanRpc';
import type { NetworkContext } from '@capabilities/network/types';

type ReadServer = Pick<InstanceType<typeof rpc.Server>, 'getNetwork' | 'simulateTransaction'>;

export function createStellarContractTokenReader(
  network: NetworkContext,
  injected?: ReadServer,
): ContractTokenReadPort {
  const id = network.id;
  if (
    (id !== 'stellar-mainnet' && id !== 'stellar-testnet') ||
    network.networkPassphrase !== NETWORKS[id].networkPassphrase
  )
    throw new Error('contract-network');
  let server = injected;
  return {
    network,
    isContractId: value => StrKey.isValidContract(value),
    isClassicAddress: value => StrKey.isValidEd25519PublicKey(value),
    classicContractId(asset) {
      if (asset.kind === 'native') return Asset.native().contractId(network.networkPassphrase);
      if (!/^[A-Za-z0-9]{1,12}$/.test(asset.code) || !StrKey.isValidEd25519PublicKey(asset.issuer))
        throw new Error('contract-asset-invalid');
      return new Asset(asset.code, asset.issuer).contractId(network.networkPassphrase);
    },
    async readToken(contractId, accountAddress, signal): Promise<ContractTokenRead> {
      const check = () => {
        if (signal.aborted) throw new Error('contract-read-retired');
      };
      check();
      if (!StrKey.isValidContract(contractId) || !StrKey.isValidEd25519PublicKey(accountAddress))
        throw new Error('contract-read-invalid');
      const rpcServer = server ?? (server = new rpc.Server(SOROBAN_RPC_URLS[id], { timeout: 10_000 }));
      const verified = await rpcServer.getNetwork();
      check();
      if (verified.passphrase !== network.networkPassphrase) throw new Error('contract-network');
      const contract = new Contract(contractId);
      const call = async (method: string, expected: string, args: readonly xdr.ScVal[] = []) => {
        check();
        // Unsigned simulation only. There is no native key call, preparation or
        // submit method in this port. Auth/write/restore requests are rejected.
        const tx = new TransactionBuilder(new Account(accountAddress, '0'), {
          fee: BASE_FEE,
          networkPassphrase: network.networkPassphrase,
        })
          .addOperation(contract.call(method, ...args))
          .setTimeout(30)
          .build();
        const response = await rpcServer.simulateTransaction(tx);
        check();
        if (
          !rpc.Api.isSimulationSuccess(response) ||
          rpc.Api.isSimulationRestore(response) ||
          !response.result ||
          !Array.isArray(response.result.auth) ||
          response.result.auth.length !== 0 ||
          (response.stateChanges && response.stateChanges.length !== 0) ||
          response.result.retval.type !== expected ||
          !Number.isSafeInteger(response.latestLedger) ||
          response.latestLedger <= 0
        )
          throw new Error('contract-read-unavailable');
        return { value: scValToNative(response.result.retval) as unknown, ledger: response.latestLedger };
      };
      const name = (await call('name', 'scvString')).value;
      const symbol = (await call('symbol', 'scvString')).value;
      const decimals = (await call('decimals', 'scvU32')).value;
      if (typeof name !== 'string' || typeof symbol !== 'string' || typeof decimals !== 'number')
        throw new Error('contract-metadata-invalid');
      const metadata = { name, symbol, decimals };
      if (!validContractMetadata(metadata)) throw new Error('contract-metadata-invalid');
      try {
        const balance = await call('balance', 'scvI128', [Address.fromString(accountAddress).toScVal()]);
        if (typeof balance.value !== 'bigint' || !validContractBaseUnits(String(balance.value)))
          throw new Error('contract-balance-invalid');
        return { metadata, balance: { baseUnits: String(balance.value), ledger: balance.ledger } };
      } catch {
        check();
        // A missing/archived/restricted account or failed simulation is unknown,
        // not a successful zero balance.
        return { metadata };
      }
    },
  };
}
