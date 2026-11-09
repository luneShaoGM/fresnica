import { useContext } from 'react';
import { Image, Switch } from 'react-native';
import { PublicIconToggle, TokenAssetIcon } from '../TokenAssetIcon';
import { TokenFallbackAvatar } from '../../../ui/components/TokenFallbackAvatar';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useContext: jest.fn(() => null),
    useEffect: jest.fn(),
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => [initial, jest.fn()],
    useSyncExternalStore: () => ({ enabled: false, revision: 0 }),
  };
});
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

describe('shared asset icon presentation', () => {
  it('renders bundled XLM square artwork rather than account-derived avatars', () => {
    const native = TokenAssetIcon({ asset: { kind: 'native', code: 'XLM' } });
    expect(native.type).toBe(Image);
    expect(native.props.source).toEqual(require('../../../ui/assets/token/xlmSquare.png'));
    expect(native.props.resizeMode).toBe('contain');
    expect(native.props.style[0]).toMatchObject({ width: 40, height: 40 });
    const small = TokenAssetIcon({ asset: { kind: 'native', code: 'XLM' }, small: true });
    expect(small.props.source).toEqual(native.props.source);
    expect(small.props.style[1]).toMatchObject({ width: 16, height: 16 });
  });

  it('uses the single local default image when public icon consent is off, not generated artwork', () => {
    const credit = TokenAssetIcon({ asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' } });
    expect(credit.type).toBe(TokenFallbackAvatar);
    expect(credit.props.small).toBe(false);
    const small = TokenAssetIcon({ asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' }, small: true });
    expect(small.type).toBe(TokenFallbackAvatar);
    expect(small.props.small).toBe(true);
  });
});

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
it('uses an explicit compact consent switch without enabling public images on mount', () => {
  const setEnabled = jest.fn();
  (useContext as jest.Mock).mockReturnValue({ available: true, setEnabled });
  const row = PublicIconToggle({ networkId: 'stellar-testnet', presentation: 'setting' });
  expect(setEnabled).not.toHaveBeenCalled();
  const toggle = row?.props.children.find((child: { type: unknown }) => child.type === Switch);
  expect(toggle.props.value).toBe(false);
  expect(toggle.props.accessibilityHint).toContain('external providers');
  toggle.props.onValueChange(true);
  expect(setEnabled).toHaveBeenLastCalledWith(true);
  toggle.props.onValueChange(false);
  expect(setEnabled).toHaveBeenLastCalledWith(false);
  expect(PublicIconToggle({ networkId: 'custom-network', presentation: 'setting' })).toBeNull();
  (useContext as jest.Mock).mockReturnValue(null);
});
