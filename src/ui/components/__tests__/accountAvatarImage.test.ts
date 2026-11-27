import { Image, StyleSheet, View } from 'react-native';
import { AccountAvatarImage } from '../AccountAvatarImage';
import { accountIdenticon } from '../AccountAvatarImage/accountIdenticon';
import { SvgXml } from 'react-native-svg';

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

it('generates fixed local artwork from the complete address, independent of frame size', () => {
  const first = 'G' + 'A'.repeat(55);
  const second = first.slice(0, -1) + 'B';
  const xml = accountIdenticon(first);
  expect(xml).toContain('viewBox="0 0 5 5"');
  expect(xml).toContain('<path');
  expect(xml).not.toContain('<metadata');
  expect(xml).not.toContain('shape-rendering');
  expect(accountIdenticon(first)).toBe(xml);
  expect(accountIdenticon(second)).not.toBe(xml);
  const small = AccountAvatarImage({ seed: first });
  const large = AccountAvatarImage({ seed: first, size: 68 });
  expect(small.props.children.type).toBe(SvgXml);
  expect(small.props.children.props).toMatchObject({ xml, width: 38, height: 38 });
  expect(large.props.children.props).toMatchObject({ xml, width: 66, height: 66 });
  expect(AccountAvatarImage({ seed: first, uri: 'data:image/png;base64,AAAA' }).type).toBe(Image);
  for (const invalid of ['G', 'S' + 'A'.repeat(55), 'https://example.com', first.toLowerCase()])
    expect(accountIdenticon(invalid)).toBeUndefined();
});
