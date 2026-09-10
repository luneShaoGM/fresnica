import React from 'react';
import {ScrollView, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type ScreenProps = React.PropsWithChildren<
  Readonly<{
    eyebrow?: string;
    title?: string;
    description?: string;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    leading?: React.ReactNode;
    scrollable?: boolean;
    contentInset?: 'default' | 'none';
    contentContainerStyle?: StyleProp<ViewStyle>;
  }>
>;

export function Screen({
  children,
  eyebrow,
  title,
  description,
  keyboardShouldPersistTaps,
  leading,
  scrollable = true,
  contentInset = 'default',
  contentContainerStyle,
}: ScreenProps) {
  const styles = useThemedStyles(createStyles);

  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </>
  );

  const containerStyle = [
    styles.screen,
    contentInset === 'none' ? styles.screenFlush : undefined,
    contentContainerStyle,
  ];

  return (
    <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={containerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          style={styles.scrollView}>
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.staticScreen, ...containerStyle]}>{content}</View>
      )}
    </SafeAreaView>
  );
}
