import { mnemonicBackupHarness } from './mnemonicBackupHarness';
import { nodes } from './sensitiveFlowHarness';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(), useRef: jest.fn(), useEffect: jest.fn(), useLayoutEffect: jest.fn(), useCallback: jest.fn(), useImperativeHandle: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn(), useIsFocused: jest.fn() }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({
  t: (key: string, params?: { position: number }) => params ? `${key}:${params.position}` : key,
}) }));

const mnemonic = 'alpha beta gamma delta epsilon zeta golf hotel india juliet kilo lima';

beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0));
afterEach(() => jest.restoreAllMocks());

it('displays the numbered word grid only through native properties, with no plaintext state/props/children', () => {
  const h = mnemonicBackupHarness(jest.fn());
  h.handle.current!.load(mnemonic);
  const root = h.render();
  expect(h.outputs().map(output => output.read())).toEqual(mnemonic.split(' '));
  expect(JSON.stringify(root)).not.toContain('alpha');
  expect(JSON.stringify(h.h.states)).not.toContain('alpha');
  h.handle.current!.clear();
  expect(h.outputs().every(output => output.read() === '')).toBe(true);
  h.render();
  expect(h.outputs()).toHaveLength(0);
  h.close();
});

it('preserves two correct answers while correcting a wrong word and consumes all answers before completion', async () => {
  const onVerified = jest.fn(async () => {
    expect(h.fields().every(field => field.native.read() === '' && field.handle.current!.read() === '')).toBe(true);
    expect(h.h.refs.some(ref => ref.current === mnemonic)).toBe(false);
  });
  const h = mnemonicBackupHarness(onVerified);
  h.handle.current!.load(mnemonic);
  h.render();
  h.press('backup.verify.start');
  h.render();
  h.fields().forEach((field, i) => field.type([' ALPHA ', 'wrong', 'Gamma'][i]));
  h.render();
  await h.press('backup.verify.submit');
  const failed = h.render();
  expect(onVerified).not.toHaveBeenCalled();
  expect(h.fields().map(field => field.native.read())).toEqual([' ALPHA ', 'wrong', 'Gamma']);
  expect(nodes(failed).some(node => node.props.accessibilityRole === 'alert')).toBe(true);
  const labels = nodes(failed).map(node => node.props.accessibilityLabel).filter(Boolean).join(' ');
  expect(labels).not.toMatch(/alpha|beta|gamma/i);
  expect(JSON.stringify(h.h.states)).not.toMatch(/alpha|wrong|gamma/i);
  h.fields()[1].type('beta');
  const corrected = h.render();
  expect(nodes(corrected).some(node => node.props.accessibilityRole === 'alert')).toBe(false);
  await h.press('backup.verify.submit');
  expect(onVerified).toHaveBeenCalledTimes(1);
  h.close();
});

it('clears answers on return to phrase, resamples and keeps completion failure retryable', async () => {
  const onVerified = jest.fn().mockRejectedValueOnce(new Error('default-persistence-failed')).mockResolvedValue(undefined);
  const h = mnemonicBackupHarness(onVerified);
  h.handle.current!.load(mnemonic);
  h.render();
  h.press('backup.verify.start');
  h.render();
  const oldFields = [...h.fields()];
  oldFields.forEach(field => field.type('wrong'));
  h.press('backup.verify.showPhrase');
  h.render();
  expect(oldFields.every(field => field.native.read() === '')).toBe(true);
  expect(h.outputs().map(output => output.read())).toEqual(mnemonic.split(' '));
  jest.mocked(Math.random).mockReturnValue(0.9);
  h.press('backup.verify.start'); h.render();
  expect(nodes(h.root()).flatMap(node => typeof node.props.accessibilityLabel === 'string'
    ? [node.props.accessibilityLabel] : [])).toEqual([
    'backup.verify.wordAccessibilityLabel:1',
    'backup.verify.wordAccessibilityLabel:11',
    'backup.verify.wordAccessibilityLabel:12',
  ]);
  h.fields().forEach((field, i) => field.type(['alpha', 'kilo', 'lima'][i])); h.render();
  await expect(h.press('backup.verify.submit')).rejects.toThrow('default-persistence-failed');
  h.render();
  expect(h.fields()).toHaveLength(0);
  expect(h.outputs()).toHaveLength(0);
  expect(h.h.refs.some(ref => ref.current === mnemonic)).toBe(false);
  jest.mocked(Math.random).mockReturnValue(0);
  h.handle.current!.load(mnemonic);
  h.render();
  await h.verify();
  expect(onVerified).toHaveBeenCalledTimes(2);
  h.close();
});

it('prevents synchronous duplicate completion and ignores its settlement after clear/unmount', async () => {
  let resolve!: () => void;
  const onVerified = jest.fn(() => new Promise<void>(done => { resolve = done; }));
  const h = mnemonicBackupHarness(onVerified);
  h.handle.current!.load(mnemonic);
  h.render();
  h.press('backup.verify.start'); h.render();
  h.fields().forEach((field, i) => field.type(['alpha', 'beta', 'gamma'][i])); h.render();
  const pending = h.press('backup.verify.submit');
  h.press('backup.verify.submit');
  expect(onVerified).toHaveBeenCalledTimes(1);
  h.handle.current!.clear();
  h.close();
  const before = JSON.stringify(h.h.states);
  resolve();
  await pending;
  expect(JSON.stringify(h.h.states)).toBe(before);
  expect(h.fields().every(field => field.native.read() === '')).toBe(true);
});

it('replaces a same-length phrase through native fields and rejects callbacks from its old presentation', () => {
  const h = mnemonicBackupHarness(jest.fn());
  h.handle.current!.load(mnemonic); h.render();
  const oldStart = nodes(h.root()).find(node => node.props.label === 'backup.verify.start')!.props.onPress as () => void;
  const replacement = mnemonic.split(' ').reverse().join(' ');
  h.handle.current!.load(replacement); h.render();
  oldStart(); h.render();
  expect(h.fields()).toHaveLength(0);
  expect(h.outputs().map(output => output.read())).toEqual(replacement.split(' '));
  h.press('backup.verify.start'); h.render();
  expect(h.fields()).toHaveLength(3);
  h.close();
});
