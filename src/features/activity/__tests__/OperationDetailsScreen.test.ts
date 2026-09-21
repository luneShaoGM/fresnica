import React from 'react';
import { Pressable, View } from 'react-native';

import { createLocalization } from '../../../locale/localization';
import { defaultTheme } from '../../../ui/theme';
import { DetailCacheStatus } from '../OperationDetailsScreen';
import { createStyles } from '../OperationDetailsScreen.styles';

type NodeProps = Readonly<{
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}>;

describe('OperationDetailsScreen cache accessibility', () => {
  it('keeps Retry outside the grouped cache-status accessibility element', () => {
    const onRefresh = jest.fn();
    const { t } = createLocalization('en');
    const root = DetailCacheStatus({
      source: 'cache',
      refreshing: false,
      refreshFailed: true,
      dateFormatter: new Intl.DateTimeFormat('en-US'),
      onRefresh,
      t,
      styles: createStyles(defaultTheme),
    });

    const children = React.Children.toArray(root.props.children).filter(
      React.isValidElement,
    ) as React.ReactElement<NodeProps>[];
    const status = children[0];
    const retry = children[1];

    expect(root.type).toBe(View);
    expect(root.props.accessible).toBeUndefined();
    expect(status?.type).toBe(View);
    expect(status?.props.accessible).toBe(true);
    expect(status?.props.accessibilityLabel).toBeTruthy();
    expect(retry?.type).toBe(Pressable);
    expect(retry?.props.accessibilityRole).toBe('button');

    retry?.props.onPress?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
