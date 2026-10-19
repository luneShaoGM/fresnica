import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';

import { defaultTheme } from '../../../ui/theme';
import { AboutScreen } from '../AboutScreen';
import { createStyles } from '../AboutScreen.styles';

jest.mock('@fresnica/ui-native', () => ({
  Button: () => null,
}));

jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

type NodeProps = Readonly<{
  children?: React.ReactNode;
  label?: string;
  onPress?: () => void;
  size?: string;
  variant?: string;
  scrollable?: boolean;
  contentInset?: string;
  showsVerticalScrollIndicator?: boolean;
  value?: string;
  style?: unknown;
}>;

function findAll(
  root: React.ReactNode,
  predicate: (element: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps>[] {
  const matches: React.ReactElement<NodeProps>[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<NodeProps>(node)) return;
    if (predicate(node)) matches.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(root);
  return matches;
}

describe('About Settings native Back control', () => {
  it('uses the existing Back handler while retaining the App safe area and hidden-indicator scroll view', () => {
    const onBack = jest.fn();
    const root = AboutScreen({ onBack, appName: 'Fresnica Wallet', projectName: 'Fresnica Mobile' });
    const [back] = findAll(root, element => element.type === NativeButton);

    expect(back?.props).toMatchObject({
      label: 'Back',
      size: 'sm',
      variant: 'quiet',
      onPress: onBack,
    });
    back?.props.onPress?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(findAll(root, element => element.type === NativeButton)).toHaveLength(1);
    expect(findAll(root, element => element.type === Screen)[0]?.props).toMatchObject({
      scrollable: false,
      contentInset: 'none',
    });
    expect(findAll(root, element => element.type === ScrollView)[0]?.props.showsVerticalScrollIndicator).toBe(false);
  });

  it('centers About between identical flexible header columns rather than the old fixed 42dp placeholder', () => {
    const root = AboutScreen({ onBack: jest.fn(), appName: 'Fresnica', projectName: 'Fresnica Mobile' });
    const styles = createStyles(defaultTheme);
    const header = React.Children.toArray(root.props.children).find(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child) && child.type === View,
    );

    expect(header?.props.style).toEqual(styles.header);
    const columns = React.Children.toArray(header?.props.children).filter(
      (child): child is React.ReactElement<NodeProps> => React.isValidElement<NodeProps>(child),
    );
    expect(columns).toHaveLength(3);
    const [left, title, right] = columns;
    expect(left?.type).toBe(View);
    expect(title?.type).toBe(Text);
    expect(right?.type).toBe(View);
    expect(left?.props.style).toEqual(styles.headerSide);
    expect(right?.props.style).toEqual(styles.headerSide);
    expect(styles.headerSide).toMatchObject({ flex: 1, alignItems: 'flex-start' });
    expect(styles.header).not.toHaveProperty('justifyContent', 'space-between');
    expect(
      React.Children.toArray(left?.props.children).some(
        child => React.isValidElement(child) && child.type === NativeButton,
      ),
    ).toBe(true);
  });

  it('preserves supplied names, static info rows, compatibility notice and semantic layout dimensions', () => {
    const root = AboutScreen({ onBack: jest.fn(), appName: 'App Display Name', projectName: 'Project Display Name' });
    const infoRows = findAll(root, element => typeof element.props.label === 'string' && !!element.props.value);
    const rows = infoRows.map(element => [element.props.label, element.props.value]);

    expect(rows).toEqual([
      ['Project', 'Project Display Name'],
      ['Network', 'Stellar Testnet'],
      ['Runtime', 'React Native 0.87'],
      ['Security', 'Fresnica Native SDK'],
    ]);

    const text = findAll(root, element => element.type === Text).flatMap(element =>
      React.Children.toArray(element.props.children).filter(child => typeof child === 'string'),
    );
    expect(text).toContain('App Display Name');
    expect(text).toContain('Compatibility');
    expect(text.join(' ')).toContain('Native SDK and adapter compatibility');

    const styles = createStyles(defaultTheme);
    expect(styles.header.minHeight).toBe(58);
    expect(styles.content.paddingBottom).toBe(38);
    expect(styles.infoRow.minHeight).toBe(56);
    expect(styles.headerSide.flex).toBe(1);
  });
});
