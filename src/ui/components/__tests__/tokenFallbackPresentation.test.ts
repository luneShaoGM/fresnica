import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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

type Element = React.ReactElement<{ children?: React.ReactNode; small?: boolean; style?: unknown }>;
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
    expect(nodes(root, Svg)).toHaveLength(1);
    expect(nodes(root, Circle)).toHaveLength(2);
    expect(nodes(root, Path)).toHaveLength(1);
    expect(root.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    const small = TokenFallbackAvatar({ small: true });
    expect(nodes(small, Circle)).toHaveLength(2);
    expect(small.props.style).not.toEqual(root.props.style);
    expect(nodes(small, Svg)[0].props).toEqual(nodes(root, Svg)[0].props);
  });

  it('keeps address-driven local user avatar distinct from a missing token image', () => {
    const user = IdentityAvatar({ identity: 'GCOUNTERPARTY' });
    const token = TokenFallbackAvatar({});
    expect(nodes(user, Path)[0].props).not.toEqual(nodes(token, Path)[0].props);
    expect(nodes(token, Circle)).toHaveLength(2);
    expect(nodes(user, Circle)).toHaveLength(0);
  });
});
