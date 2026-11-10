import { Image } from 'react-native';
import { TokenAssetIcon } from '../TokenAssetIcon';
import { TokenFallbackAvatar } from '../../../ui/components/TokenFallbackAvatar';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useContext: () => null,
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
