import { Image, StyleSheet, View } from 'react-native';
import { AccountAvatarImage } from '../AccountAvatarImage';

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});
it('uses one frame for user photos and generic fallback, independently of card layout or labels', () => {
  const image = AccountAvatarImage({ uri: 'data:image/png;base64,AAAA' });
  const fallback = AccountAvatarImage({});
  expect(image.type).toBe(Image);
  expect(fallback.type).toBe(View);
  expect(image.props.style).toEqual(fallback.props.style);
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: 40, height: 40, borderRadius: 11 });
  expect(image.props.resizeMode).toBe('cover');
  expect(image.props).toMatchObject({
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  expect(fallback.props).toMatchObject({
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
});
it('scales image and fallback together for account detail without choosing a different identity graphic', () => {
  const image = AccountAvatarImage({ uri: 'data:image/png;base64,AAAA', size: 68 });
  const fallback = AccountAvatarImage({ size: 68 });
  expect(image.props.style).toEqual(fallback.props.style);
  expect(StyleSheet.flatten(image.props.style)).toMatchObject({ width: 68, height: 68, borderRadius: (68 * 11) / 40 });
});
