import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '../Screen';

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual<typeof import('@ui/theme')>('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

describe('shared Screen safe area contract', () => {
  it('keeps bottom inset by default for details and forms', () => {
    const root = Screen({ scrollable: false, children: React.createElement(React.Fragment) });
    expect(root.type).toBe(SafeAreaView);
    expect(root.props.edges).toEqual(['top', 'right', 'bottom', 'left']);
  });

  it('allows a tab root to delegate the bottom inset to its shared bar', () => {
    const root = Screen({
      scrollable: false,
      safeAreaEdges: ['top', 'right', 'left'],
      children: React.createElement(React.Fragment),
    });
    expect(root.type).toBe(SafeAreaView);
    expect(root.props.edges).toEqual(['top', 'right', 'left']);
  });
});
