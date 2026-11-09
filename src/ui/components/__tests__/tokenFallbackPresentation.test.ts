import React from 'react';
import { Image, View } from 'react-native';
import { Path } from 'react-native-svg';
import { IdentityAvatar } from '../IdentityAvatar';
import { TokenFallbackAvatar } from '../TokenFallbackAvatar';

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});

type Element = React.ReactElement<{
  children?: React.ReactNode;
  small?: boolean;
  source?: unknown;
  resizeMode?: string;
  style?: unknown;
}>;
function nodes(root: React.ReactNode, type: unknown): Element[] {
  const matches: Element[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
    if (node.type === type) matches.push(node as Element);
    React.Children.forEach(node.props.children, visit);
  };
  visit(root);
  return matches;
}

describe('S06 default token vs S22 local identity avatar presentation', () => {
  it('renders one neutral unknown-token mark without any code/issuer input or network request', () => {
    const root = TokenFallbackAvatar({});
    expect(nodes(root, View)).toHaveLength(1);
    expect(nodes(root, Image)).toHaveLength(1);
    expect(nodes(root, Image)[0].props.source).toEqual(require('../TokenFallbackAvatar/assets/unknownTokenLight.png'));
    const containerStyle = (root.props.style as ReadonlyArray<{ backgroundColor?: string } | undefined>)[0];
    expect(containerStyle?.backgroundColor).toBeUndefined();

    expect(root.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    const small = TokenFallbackAvatar({ small: true });
    expect(nodes(small, Image)).toHaveLength(1);
    expect(small.props.style).not.toEqual(root.props.style);
    expect(nodes(small, Image)[0].props.source).toEqual(nodes(root, Image)[0].props.source);
    expect(nodes(small, Image)[0].props.resizeMode).toBe('contain');
    expect(nodes(small, Image)[0].props.style).toEqual({ width: '100%', height: '100%' });
  });

  it('keeps address-driven local user avatar distinct from a missing token image', () => {
    const user = IdentityAvatar({ identity: 'GCOUNTERPARTY' });
    const token = TokenFallbackAvatar({});
    expect(nodes(user, Path)).toHaveLength(1);
    expect(nodes(token, Image)).toHaveLength(1);
    expect(nodes(token, Path)).toHaveLength(0);
  });
});
