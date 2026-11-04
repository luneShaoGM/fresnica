import type { HistoryOperationRecord } from './HistoryGateway';
import { pathAsset } from './pathPaymentHistory';
import type { HistoryContractEntry, HistoryContractEvent, HistoryEntryBase } from './types';

export const CONTRACT_HOST_FUNCTIONS = {
  invoke: 'HostFunctionTypeHostFunctionTypeInvokeContract',
  create: 'HostFunctionTypeHostFunctionTypeCreateContract',
  'create-v2': 'HostFunctionTypeHostFunctionTypeCreateContractV2',
  upload: 'HostFunctionTypeHostFunctionTypeUploadContractWasm',
} as const;
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function contractParty(value: unknown): value is string {
  return typeof value === 'string' && /^[GC][A-Z2-7]{55}$/.test(value);
}
export function contractAmount(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{1,39}(?:\.\d{1,7})?$/.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, '0')) <= 170141183460469231731687303715884105727n;
}
export function contractAssociated(record: HistoryOperationRecord, address: string): boolean {
  if (record.sourceAccount === address) return true;
  if (
    record.hostFunction !== CONTRACT_HOST_FUNCTIONS.invoke &&
    record.hostFunction !== CONTRACT_HOST_FUNCTIONS['create-v2']
  )
    return false;
  const events = record.assetBalanceChanges;
  return (
    Array.isArray(events) &&
    events.length <= 128 &&
    events.some(
      candidate =>
        object(candidate) &&
        ((contractParty(candidate.from) && candidate.from === address) ||
          (contractParty(candidate.to) && candidate.to === address)),
    )
  );
}
function event(value: unknown, account: string): HistoryContractEvent | undefined {
  if (
    !object(value) ||
    typeof value.type !== 'string' ||
    !['transfer', 'mint', 'burn', 'clawback'].includes(value.type)
  )
    return undefined;
  const type = value.type as HistoryContractEvent['type'];
  const asset = pathAsset(value.asset as HistoryOperationRecord['asset']);
  if (!asset || !contractAmount(value.amount)) return undefined;
  const hasFrom = type !== 'mint';
  const hasTo = type === 'mint' || type === 'transfer';
  if (
    (hasFrom ? !contractParty(value.from) : value.from !== undefined && value.from !== '') ||
    (hasTo ? !contractParty(value.to) : value.to !== undefined && value.to !== '')
  )
    return undefined;
  const route = value.destinationMuxedId;
  if (
    route !== undefined &&
    (!hasTo ||
      typeof value.to !== 'string' ||
      !value.to.startsWith('G') ||
      typeof route !== 'string' ||
      !/^(?:0|[1-9]\d{0,19})$/.test(route) ||
      BigInt(route) > 18446744073709551615n)
  )
    return undefined;
  const from = hasFrom ? (value.from as string) : undefined;
  const to = hasTo ? (value.to as string) : undefined;
  return Object.freeze({
    type,
    asset,
    amount: value.amount,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(route === undefined ? {} : { destinationMuxedId: route as string }),
    direction: from === account ? (to === account ? 'self' : 'outgoing') : to === account ? 'incoming' : 'neutral',
  });
}
export function mapContract(
  record: HistoryOperationRecord,
  account: string,
  base: HistoryEntryBase,
): HistoryContractEntry | undefined {
  if (
    record.type !== 'invoke_host_function' ||
    record.successful !== true ||
    !/^G[A-Z2-7]{55}$/.test(record.sourceAccount) ||
    record.sourceAccount !== base.sourceAccount ||
    !contractAssociated(record, account)
  )
    return undefined;
  const hostFunction = (Object.keys(CONTRACT_HOST_FUNCTIONS) as (keyof typeof CONTRACT_HOST_FUNCTIONS)[]).find(
    key => CONTRACT_HOST_FUNCTIONS[key] === record.hostFunction,
  );
  if (!hostFunction) return undefined;
  if (
    hostFunction === 'invoke' &&
    (typeof record.contractId !== 'string' || !/^C[A-Z2-7]{55}$/.test(record.contractId))
  )
    return undefined;
  if (
    hostFunction === 'invoke' &&
    (typeof record.functionName !== 'string' || !/^[A-Za-z0-9_]{1,32}$/.test(record.functionName))
  )
    return undefined;
  const creation = hostFunction === 'create' || hostFunction === 'create-v2';
  const creationAsset = creation && record.creationOrigin === 'asset' ? pathAsset(record.creationAsset) : undefined;
  if (
    creation &&
    !(record.creationOrigin === 'address'
      ? contractParty(record.deployer)
      : record.creationOrigin === 'asset' && creationAsset)
  )
    return undefined;
  const raw = record.assetBalanceChanges;
  let events: readonly HistoryContractEvent[] | undefined;
  if (raw !== undefined && raw !== null) {
    if (
      !Array.isArray(raw) ||
      raw.length > 128 ||
      (hostFunction !== 'invoke' && hostFunction !== 'create-v2' && raw.length > 0)
    )
      return undefined;
    const normalized = raw.map(value => event(value, account));
    if (normalized.some(value => !value)) return undefined;
    events = Object.freeze(normalized as HistoryContractEvent[]);
  }
  return Object.freeze({
    ...base,
    kind: 'contract',
    successful: true,
    hostFunction,
    ...(hostFunction === 'invoke' ? { contractId: record.contractId as string } : {}),
    ...(creation
      ? {
          creationOrigin: record.creationOrigin as 'address' | 'asset',
          ...(record.creationOrigin === 'address'
            ? { deployer: record.deployer as string }
            : { creationAsset: creationAsset! }),
        }
      : {}),
    ...(hostFunction === 'invoke' ? { functionName: record.functionName as string } : {}),
    ...(events === undefined ? {} : { events }),
  });
}
