import { Address, Asset, Networks, xdr } from '@stellar/stellar-sdk';

import type { DappSorobanIntent } from '../../capabilities/dapp-interaction/dappTransactionIntent';

const BLEND_TESTNET_V21_POOL = 'CB3447A446DY3USGWPIDXTNQHF5EX24XDQA2EN6TAZP62JTPBTNOA52Q';
const NATIVE_TOKEN = Asset.native().contractId(Networks.TESTNET);

function address(value: xdr.ScVal | undefined): string | undefined {
  return value?.type === 'scvAddress' ? Address.fromScAddress(value.address).toString() : undefined;
}

function amount(value: xdr.ScVal | undefined): bigint | undefined {
  if (value?.type !== 'scvI128' || value.i128.hi < 0n) return undefined;
  const units = (value.i128.hi << 64n) | value.i128.lo;
  return units > 0n && units <= 0x7fff_ffff_ffff_ffffn ? units : undefined;
}

function formatXlm(units: bigint): string {
  const digits = units.toString().padStart(8, '0');
  return digits.slice(0, -7) + '.' + digits.slice(-7);
}

function transfer(
  call: xdr.InvokeContractArgs,
  source: string,
): Readonly<{ destination: string; units: bigint }> | undefined {
  if (
    Address.fromScAddress(call.contractAddress).toString() !== NATIVE_TOKEN ||
    call.functionName.toString() !== 'transfer' ||
    call.args.length !== 3 ||
    address(call.args[0]) !== source
  ) {
    return undefined;
  }
  const destination = address(call.args[1]);
  const units = amount(call.args[2]);
  if (!destination || destination === source || units === undefined) return undefined;
  return { destination, units };
}

export function readReviewableSorobanOperation(
  operation: xdr.Operation,
  source: string,
): DappSorobanIntent | undefined {
  if (operation.body.type !== 'invokeHostFunction') return undefined;
  const { hostFunction, auth } = operation.body.invokeHostFunctionOp;
  if (hostFunction.type !== 'hostFunctionTypeInvokeContract' || auth.length !== 1) return undefined;
  const entry = auth[0];
  if (entry.credentials.type !== 'sorobanCredentialsSourceAccount') return undefined;

  const call = hostFunction.invokeContract;
  const root = entry.rootInvocation;
  if (
    root.function.type !== 'sorobanAuthorizedFunctionTypeContractFn' ||
    root.function.contractFn.toXdr('base64') !== call.toXdr('base64')
  ) {
    return undefined;
  }

  const contract = Address.fromScAddress(call.contractAddress).toString();
  const method = call.functionName.toString();
  if (contract === NATIVE_TOKEN && root.subInvocations.length === 0) {
    const movement = transfer(call, source);
    if (!movement) return undefined;
    return Object.freeze({
      type: 'soroban-transfer',
      contract,
      destination: movement.destination,
      amount: formatXlm(movement.units),
      assetCode: 'XLM',
    });
  }

  if (contract !== BLEND_TESTNET_V21_POOL || method !== 'submit' || root.subInvocations.length !== 1) {
    return undefined;
  }
  const [from, spender, to, requests] = call.args;
  if (
    call.args.length !== 4 ||
    [from, spender, to].some(arg => address(arg) !== source) ||
    requests?.type !== 'scvVec' ||
    requests.vec?.length !== 1
  ) {
    return undefined;
  }
  const request = requests.vec[0];
  if (request.type !== 'scvMap' || request.map?.length !== 3) return undefined;
  const [requestedAddress, requestedAmount, requestedType] = request.map;
  if (
    requestedAddress.key.type !== 'scvSymbol' ||
    requestedAddress.key.sym.toString() !== 'address' ||
    address(requestedAddress.val) !== NATIVE_TOKEN ||
    requestedAmount.key.type !== 'scvSymbol' ||
    requestedAmount.key.sym.toString() !== 'amount' ||
    requestedType.key.type !== 'scvSymbol' ||
    requestedType.key.sym.toString() !== 'request_type' ||
    requestedType.val.type !== 'scvU32' ||
    requestedType.val.u32 !== 2 // Blend SupplyCollateral.
  ) {
    return undefined;
  }
  const nested = root.subInvocations[0];
  if (nested.function.type !== 'sorobanAuthorizedFunctionTypeContractFn' || nested.subInvocations.length !== 0) {
    return undefined;
  }
  const movement = transfer(nested.function.contractFn, source);
  if (!movement || movement.destination !== contract || movement.units !== amount(requestedAmount.val)) {
    return undefined;
  }
  return Object.freeze({
    type: 'soroban-supply-collateral',
    contract,
    destination: movement.destination,
    amount: formatXlm(movement.units),
    assetCode: 'XLM',
  });
}
