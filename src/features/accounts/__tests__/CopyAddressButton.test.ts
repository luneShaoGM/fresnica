import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { CopyAddressButton } from '../CopyAddressButton';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return { ...actual, useState: jest.fn(), useContext: () => undefined };
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
  setStatus.mockReset();
  mockedUseState.mockReturnValue(['idle', setStatus]);
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
