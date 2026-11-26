import React from 'react';
import QRCode from 'react-native-qrcode-svg';

import { CopyAddressButton } from '@features/accounts/CopyAddressButton';
import { BottomSheet } from '@ui/components/BottomSheet';
import { NativeButton } from '@ui/components/NativeButton';

import { ReceiveSheet } from '../ReceiveSheet';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: (initial: unknown) => ({ current: initial }),
}));
jest.mock('react-native-qrcode-svg', () => ({ __esModule: true, default: () => null }));
jest.mock('@ui/theme', () => ({
  useThemedStyles: (factory: (theme: unknown) => unknown) => factory(jest.requireActual('@ui/theme').defaultTheme),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));

type Node = React.ReactElement<{ children?: React.ReactNode }>;
function descendants(root: React.ReactNode): Node[] {
  if (!React.isValidElement<Node['props']>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(descendants)];
}

const address = 'G' + 'A'.repeat(55);

it('shows and copies the full address and encodes that exact address in the QR', async () => {
  const copyPublicText = jest.fn().mockResolvedValue(undefined);
  const root = ReceiveSheet({
    address,
    networkId: 'stellar-testnet',
    copyPublicText,
    onClose: jest.fn(),
    onCreateRequestLink: jest.fn(),
  });
  const nodes = descendants(root);
  const copy = nodes.find(node => node.type === CopyAddressButton) as React.ReactElement<
    React.ComponentProps<typeof CopyAddressButton>
  >;
  const qr = nodes.find(node => node.type === QRCode);

  expect(root.type).toBe(BottomSheet);
  expect(nodes.some(node => node.props.children === 'Stellar Testnet')).toBe(true);
  expect(copy.props).toMatchObject({ address, numberOfLines: 0 });
  expect(qr?.props).toMatchObject({ value: address });
  await copy.props.copyPublicText(copy.props.address);
  expect(copyPublicText).toHaveBeenCalledWith(address);
});

it('closes the sheet before opening Request and consumes the button press once', () => {
  const order: string[] = [];
  const root = ReceiveSheet({
    address,
    networkId: 'stellar-testnet',
    copyPublicText: jest.fn(),
    onClose: () => order.push('close'),
    onCreateRequestLink: () => order.push('request'),
  });
  const action = descendants(root).find(node => node.type === NativeButton) as React.ReactElement<
    React.ComponentProps<typeof NativeButton>
  >;

  expect(action.props.label).toBe('Create request link');
  action.props.onPress?.();
  action.props.onPress?.();
  expect(order).toEqual(['close', 'request']);
});
