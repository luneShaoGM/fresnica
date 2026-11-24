import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text } from 'react-native';
import { CopyAddressButton } from '../CopyAddressButton';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: jest.fn(),
    useContext: () => undefined,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: jest.fn(),
  };
});
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
const mockedUseState = useState as unknown as jest.Mock;
const setStatus = jest.fn();

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
    .mockClear();
  jest.mocked(useEffect).mockReset();
  setStatus.mockReset();
  mockedUseState.mockReturnValue(['idle', setStatus]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('copies only the full selected address after a tap and reports success', async () => {
  const copyPublicText = jest.fn(async () => undefined);
  const root = CopyAddressButton({ address: 'MFULL-MUXED-ADDRESS', copyPublicText });
  expect(copyPublicText).not.toHaveBeenCalled();
  const [addressText, button] = root.props.children[0].props.children;
  expect(addressText.type).toBe(Text);
  expect(addressText.props.children).toBe('MFULL-MUXED-ADDRESS');
  expect(button.type).toBe(Pressable);
  expect(button.props.accessibilityLabel).toBe('accounts.copy.action');
  await root.props.children[0].props.children[1].props.onPress();
  expect(copyPublicText).toHaveBeenCalledTimes(1);
  expect(copyPublicText).toHaveBeenCalledWith('MFULL-MUXED-ADDRESS');
  expect(setStatus.mock.calls).toEqual([['copying'], ['copied']]);
});

it('handles a failed write without exposing the error and allows retry', async () => {
  const copyPublicText = jest.fn().mockRejectedValueOnce(new Error('native details')).mockResolvedValueOnce(undefined);
  const root = CopyAddressButton({ address: 'GSECOND', copyPublicText });
  await root.props.children[0].props.children[1].props.onPress();
  expect(setStatus).toHaveBeenLastCalledWith('error');
  mockedUseState.mockReturnValue(['error', setStatus]);
  const retry = CopyAddressButton({ address: 'GSECOND', copyPublicText });
  await retry.props.children[0].props.children[1].props.onPress();
  expect(copyPublicText.mock.calls).toEqual([['GSECOND'], ['GSECOND']]);
  expect(setStatus).toHaveBeenLastCalledWith('copied');
});

it('disables repeated copying while the write is pending', async () => {
  mockedUseState.mockReturnValue(['copying', setStatus]);
  const copyPublicText = jest.fn();
  const root = CopyAddressButton({ address: 'GADDRESS', copyPublicText });
  expect(root.props.children[0].props.children[1].props.disabled).toBe(true);
  await root.props.children[0].props.children[1].props.onPress();
  expect(copyPublicText).not.toHaveBeenCalled();
});

it.each(['copied', 'error'])('renders accessible %s feedback', status => {
  mockedUseState.mockReturnValue([status, setStatus]);
  const root = CopyAddressButton({ address: 'GADDRESS', copyPublicText: jest.fn() });
  const feedback = root.props.children[1];
  expect(feedback.type).toBe(Text);
  expect(feedback.props.accessibilityLiveRegion).toBe('polite');
  expect(feedback.props.children).toBe(status === 'copied' ? 'accounts.copy.success' : 'accounts.copy.error');
});

it('uses the address shortening rule for a hash but copies the complete original value', async () => {
  const hash = 'abcdef0123456789'.repeat(4);
  const copyPublicText = jest.fn(async () => undefined);
  const root = CopyAddressButton({ address: hash, copyPublicText, kind: 'transaction-hash' });
  const [text, button] = root.props.children[0].props.children;
  expect(text.props.children).toBe('abcd...6789');
  expect(text.props.accessibilityLabel).toBe(hash);
  expect(button.props.accessibilityLabel).toBe('activity.detail.hashCopy.action');
  expect(copyPublicText).not.toHaveBeenCalled();
  await button.props.onPress();
  expect(copyPublicText).toHaveBeenCalledWith(hash);
  expect(setStatus.mock.calls).toEqual([['copying'], ['copied']]);
});

it.each(['copied', 'error'])('uses hash-specific accessible %s feedback', status => {
  mockedUseState.mockReturnValue([status, setStatus]);
  const root = CopyAddressButton({
    address: 'abcdef0123456789'.repeat(4),
    copyPublicText: jest.fn(),
    kind: 'transaction-hash',
  });
  const feedback = root.props.children[1];
  expect(feedback.props.accessibilityLiveRegion).toBe('polite');
  expect(feedback.props.children).toBe(
    status === 'copied' ? 'activity.detail.hashCopy.success' : 'activity.detail.hashCopy.error',
  );
});

const copyCases = [
  ['address', 'MFULL-MUXED-ADDRESS', 'accounts.copy'],
  ['transaction-hash', 'abcdef0123456789'.repeat(4), 'activity.detail.hashCopy'],
] as const;

describe.each(copyCases)('%s copy accessibility', (kind, address, messageKey) => {
  it('announces each completed iOS copy and never the pending state or copied value', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    let resolveCopy!: () => void;
    const copyPublicText = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveCopy = resolve;
        }),
    );
    const root = CopyAddressButton({ address, copyPublicText, kind });
    const pending = root.props.children[0].props.children[1].props.onPress();
    expect(copyPublicText).toHaveBeenCalledWith(address);
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    resolveCopy();
    await pending;
    expect(setStatus).toHaveBeenLastCalledWith('copied');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(messageKey + '.success');
    mockedUseState.mockReturnValue(['copied', setStatus]);
    const copied = CopyAddressButton({ address, copyPublicText, kind });
    expect(copied.props.children[1].props.children).toBe(messageKey + '.success');
    expect(copied.props.children[1].props.accessibilityLiveRegion).toBeUndefined();
    const repeated = copied.props.children[0].props.children[1].props.onPress();
    resolveCopy();
    await repeated;
    expect(jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls).toEqual([
      [messageKey + '.success'],
      [messageKey + '.success'],
    ]);
  });

  it('announces the localized iOS failure and retry success without native error details', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const copyPublicText = jest
      .fn()
      .mockRejectedValueOnce(new Error('private diagnostic'))
      .mockResolvedValueOnce(undefined);
    const root = CopyAddressButton({ address, copyPublicText, kind });
    await root.props.children[0].props.children[1].props.onPress();
    expect(setStatus).toHaveBeenLastCalledWith('error');
    mockedUseState.mockReturnValue(['error', setStatus]);
    const retry = CopyAddressButton({ address, copyPublicText, kind });
    expect(retry.props.children[1].props.children).toBe(messageKey + '.error');
    expect(retry.props.children[1].props.accessibilityLiveRegion).toBeUndefined();
    await retry.props.children[0].props.children[1].props.onPress();
    expect(copyPublicText.mock.calls).toEqual([[address], [address]]);
    expect(setStatus).toHaveBeenLastCalledWith('copied');
    expect(jest.mocked(AccessibilityInfo.announceForAccessibility).mock.calls).toEqual([
      [messageKey + '.error'],
      [messageKey + '.success'],
    ]);
  });

  it('keeps the Android live region and does not issue a second explicit announcement', async () => {
    const copyPublicText = jest.fn().mockRejectedValueOnce(new Error('native error')).mockResolvedValueOnce(undefined);
    await CopyAddressButton({ address, copyPublicText, kind }).props.children[0].props.children[1].props.onPress();
    mockedUseState.mockReturnValue(['error', setStatus]);
    const failed = CopyAddressButton({ address, copyPublicText, kind });
    expect(failed.props.children[1].props.accessibilityLiveRegion).toBe('polite');
    expect(failed.props.children[1].props.children).toBe(messageKey + '.error');
    await failed.props.children[0].props.children[1].props.onPress();
    mockedUseState.mockReturnValue(['copied', setStatus]);
    const copied = CopyAddressButton({ address, copyPublicText, kind });
    expect(copied.props.children[1].props.accessibilityLiveRegion).toBe('polite');
    expect(copied.props.children[1].props.children).toBe(messageKey + '.success');
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it('suppresses a late iOS copy announcement after the keyed row unmounts', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    let unmount: (() => void) | undefined;
    jest.mocked(useEffect).mockImplementation(effect => {
      const cleanup = effect();
      if (typeof cleanup === 'function') unmount = cleanup;
    });
    let resolveCopy!: () => void;
    const copyPublicText = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveCopy = resolve;
        }),
    );
    const pending = CopyAddressButton({
      address,
      copyPublicText,
      kind,
    }).props.children[0].props.children[1].props.onPress();
    expect(unmount).toBeDefined();
    unmount?.();
    resolveCopy();
    await pending;
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    expect(setStatus.mock.calls).toEqual([['copying']]);
  });
});
