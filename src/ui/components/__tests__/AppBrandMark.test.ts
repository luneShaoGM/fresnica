import { Image } from 'react-native';
import { AppBrandMark } from '../AppBrandMark';

describe('shared Fresnica rocket logo', () => {
  it('uses a bundled local image at logical-point sizes without substituting old brand lettering', () => {
    const root = AppBrandMark();
    expect(root.type).toBe(Image);
    expect(root.props.source).toEqual(require('../../assets/brand/fresnicaMark.png'));
    expect(root.props.style).toEqual({ width: 32, height: 32 });
    expect(root.props.accessible).toBe(false);
    expect(root.props.resizeMode).toBe('contain');
    expect(AppBrandMark().props.style).toEqual(root.props.style);
  });
});
