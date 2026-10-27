import type { AccountRecord } from '@capabilities/account/types';
import { TransactionResult } from '@ui/components';
import type { SwapTerminalResult } from '../SwapResultScreen';

jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
const react = jest.requireActual<typeof import('react')>('react');
let cursor = 0;
let refCursor = 0;
const states: unknown[] = [];
const refs: Array<{ current: unknown }> = [];
let cleanups: Array<() => void> = [];
jest.spyOn(react, 'useState').mockImplementation(((initial: unknown) => {
  const i = cursor++;
  if (!(i in states)) states[i] = initial;
  return [
    states[i],
    (value: unknown) => {
      states[i] = value;
    },
  ];
}) as typeof react.useState);
jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => {
  const i = refCursor++;
  if (!refs[i]) refs[i] = { current: initial };
  return refs[i];
}) as typeof react.useRef);
jest.spyOn(react, 'useEffect').mockImplementation(effect => {
  const cleanup = effect();
  if (cleanup) cleanups.push(cleanup);
});
const { SwapResultScreen } = require('../SwapResultScreen') as typeof import('../SwapResultScreen');
const account = { id: 'a', address: 'GSOURCE', networkId: 'stellar-testnet' } as AccountRecord;
const hash = 'a'.repeat(64);
const uncertain: SwapTerminalResult = { status: 'uncertain', transactionHash: hash };
function setup(result: SwapTerminalResult = uncertain) {
  const copy = jest.fn(async (_text: string): Promise<void> => undefined);
  const open = jest.fn(async (_url: string): Promise<void> => undefined);
  const done = jest.fn();
  let current = true;
  const props = {
    account,
    result,
    captureSession: () => () => current,
    copyPublicText: copy,
    openExternalUrl: open,
    onDone: done,
    children: 'recovery-panel',
  };
  const render = () => {
    cursor = 0;
    refCursor = 0;
    return SwapResultScreen(props);
  };
  return {
    render,
    props,
    copy,
    open,
    done,
    expire: () => {
      current = false;
    },
  };
}
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
beforeEach(() => {
  states.length = 0;
  refs.length = 0;
  cleanups = [];
});
afterEach(() => cleanups.forEach(cleanup => cleanup()));

it.each<[SwapTerminalResult, string]>([
  [{ status: 'submitted', hash, ledger: 123, authorization: 'system-auth' }, 'success'],
  [uncertain, 'unverified'],
  [{ status: 'rejected', transactionHash: hash, resultCode: 'tx_bad_seq' }, 'failed'],
  [{ status: 'authorization-blocked', reason: 'watch-only', requiredWeight: 1, availableWeight: 0 }, 'failed'],
  [{ status: 'unsupported-signer' }, 'failed'],
])('preserves the terminal status and its evidence: %s', (result, tone) => {
  const h = setup(result);
  const root = h.render();
  expect(root.type).toBe(TransactionResult);
  expect(root.props.tone).toBe(tone);
  expect(root.props.title).toBe('swap.result.' + result.status);
  expect(root.props.children).toBe('recovery-panel');
  if ('hash' in result || 'transactionHash' in result)
    expect(root.props.details).toContainEqual({ label: 'swap.history.hash', value: hash });
  if (result.status === 'submitted') {
    expect(root.props.details).toContainEqual({ label: 'swap.history.ledger', value: '123' });
    expect(root.props.details).toContainEqual({ label: 'swap.execution.authorization', value: 'system-auth' });
  }
  if (result.status === 'rejected')
    expect(root.props.details).toContainEqual({ label: 'swap.result.code', value: 'tx_bad_seq' });
  root.props.primaryAction.onPress();
  expect(h.done).toHaveBeenCalledTimes(1);
});
it('copies only the original hash and opens the original network explorer', async () => {
  const h = setup();
  let root = h.render();
  root.props.actions[0].onPress();
  await settle();
  expect(h.copy).toHaveBeenCalledWith(hash);
  root = h.render();
  expect(root.props.actions[0].label).toBe('swap.result.copiedHash');
  root.props.actions[1].onPress();
  await settle();
  expect(h.open).toHaveBeenCalledWith(`https://stellar.expert/explorer/testnet/tx/${hash}`);
  expect(h.render().props.tone).toBe('unverified');
});
it('keeps failed output retryable without changing transaction outcome', async () => {
  const h = setup();
  h.copy.mockRejectedValueOnce(new Error('clipboard'));
  h.render().props.actions[0].onPress();
  await settle();
  let root = h.render();
  expect(root.props.notice).toBe('swap.result.outputError');
  expect(root.props.tone).toBe('unverified');
  root.props.actions[0].onPress();
  await settle();
  root = h.render();
  expect(root.props.notice).toBeUndefined();
  expect(h.copy).toHaveBeenCalledTimes(2);
});
it('blocks duplicate output and ignores completions after unmount', async () => {
  const h = setup();
  let finish!: () => void;
  h.copy.mockImplementationOnce(
    () =>
      new Promise<void>(done => {
        finish = done;
      }),
  );
  const root = h.render();
  root.props.actions[0].onPress();
  root.props.actions[0].onPress();
  expect(h.copy).toHaveBeenCalledTimes(1);
  cleanups.forEach(cleanup => cleanup());
  finish();
  await settle();
  expect(states[0]).toBe('busy');
});
it('does not initiate output for an expired account/focus session', () => {
  const h = setup();
  const root = h.render();
  h.expire();
  root.props.actions.forEach((action: { onPress: () => void }) => action.onPress());
  expect(h.copy).not.toHaveBeenCalled();
  expect(h.open).not.toHaveBeenCalled();
});
it('does not offer explorer URLs for unknown networks', () => {
  const h = setup();
  h.props.account = { ...account, networkId: 'unknown' };
  expect(h.render().props.actions).toHaveLength(1);
});
