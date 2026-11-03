import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AccountIdentityCard } from '../AccountIdentityCard';
import { IdentityAvatar } from '../IdentityAvatar';
import { identityAvatarPattern } from '../IdentityAvatar/IdentityAvatar';
jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});
type Props = { children?: React.ReactNode; identity?: string; selectable?: boolean; accessibilityLabel?: string };
function nodes(root: React.ReactNode, type: unknown): React.ReactElement<Props>[] {
  const result: React.ReactElement<Props>[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<Props>(node)) return;
    if (node.type === type) result.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(root);
  return result;
}
it('keeps the default account card address selectable with its public full-address accessibility label', () => {
  const root = AccountIdentityCard({ address: 'GCOUNTERPARTY', name: 'Alice', label: 'Recipient' });
  const text = nodes(root, Text);
  expect(text.map(node => node.props.children)).toEqual(['Recipient', 'Alice', 'GCOU****ARTY']);
  expect(nodes(root, IdentityAvatar)[0].props.identity).toBe('GCOUNTERPARTY');
  expect(text.find(node => node.props.selectable)?.props.accessibilityLabel).toBe('GCOUNTERPARTY');
});
it('renders a single selectable identity with memo and full-address accessibility, preserving its click handler', () => {
  const onPress = jest.fn();
  const root = AccountIdentityCard({
    address: 'GCOUNTERPARTY',
    name: 'Alice',
    label: 'Local',
    presentation: 'selectable',
    memoText: 'Memo ID: 7',
    onPress,
  });
  expect(nodes(root, Pressable)).toHaveLength(1);
  expect(nodes(root, IdentityAvatar)[0].props.identity).toBe('GCOUNTERPARTY');
  expect(nodes(root, Text).map(node => node.props.children)).toEqual(['Alice', 'GCOUNTERPARTY', 'Memo ID: 7']);
  expect(root.props).toMatchObject({
    accessibilityRole: 'button',
    accessibilityLabel: 'Alice, GCOUNTERPARTY, Memo ID: 7',
  });
  root.props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
});
it('keeps compact account avatars tied to exact address across renames, with masked fallback and no nested selectable control', () => {
  const render = (name: string) =>
    AccountIdentityCard({
      address: 'GCOUNTERPARTY',
      name,
      label: 'Received',
      presentation: 'compact',
      secondary: 'Received · 12:34:56',
    });
  const initial = render('Alice');
  const renamed = render('Bob');
  expect(nodes(initial, IdentityAvatar)[0].props.identity).toBe('GCOUNTERPARTY');
  expect(nodes(renamed, IdentityAvatar)[0].props.identity).toBe('GCOUNTERPARTY');
  expect(nodes(render(''), Text).map(node => node.props.children)).toEqual(['GCOU****ARTY', 'Received · 12:34:56']);
  expect(nodes(initial, Text).some(node => node.props.selectable)).toBe(false);
});
it('uses a deterministic local identity pattern that includes case and issuer input', () => {
  const identity = JSON.stringify(['USD', 'GISSUER']);
  expect(identityAvatarPattern(identity)).toEqual(identityAvatarPattern(identity));
  expect(identityAvatarPattern(identity)).not.toEqual(identityAvatarPattern(JSON.stringify(['USD', 'GOTHER'])));
  expect(identityAvatarPattern(identity)).not.toEqual(identityAvatarPattern(JSON.stringify(['usd', 'GISSUER'])));
  const native = IdentityAvatar({ identity: 'native:XLM', native: true });
  expect(nodes(native, Text).map(node => node.props.children)).toEqual(['✦']);
  expect(nodes(IdentityAvatar({ identity: JSON.stringify(['XLM', 'GISSUER']) }), Text)).toEqual([]);
  expect(native.props).toMatchObject({
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
});

it('batches all identity cells into one local SVG path instead of native cell views', () => {
  const identity = JSON.stringify(['USD', 'GISSUER']);
  const root = IdentityAvatar({ identity });
  expect(nodes(root, View)).toHaveLength(1);
  expect(nodes(root, Svg)).toHaveLength(1);
  const paths = nodes(root, Path);
  expect(paths).toHaveLength(1);
  const path = paths[0] as React.ReactElement<{ d: string }>;
  expect(path.props.d.match(/M/g)).toHaveLength(identityAvatarPattern(identity).filter(Boolean).length);
  expect(path.props.d).toMatch(/^(M[0-4] [0-4]h1v1h-1Z)+$/);
});
