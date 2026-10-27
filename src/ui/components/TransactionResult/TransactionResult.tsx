import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useThemedStyles } from '@ui/theme';
import { createStyles } from './styles';

export type TransactionResultTone = 'success' | 'failed' | 'unverified';
export type TransactionResultDetail = Readonly<{ label: string; value: string }>;
export type TransactionResultAction = Readonly<{ label: string; onPress: () => void; disabled?: boolean }>;
type Props = React.PropsWithChildren<
  Readonly<{
    tone: TransactionResultTone;
    title: string;
    subtitle: string;
    details: readonly TransactionResultDetail[];
    actions: readonly TransactionResultAction[];
    notice?: string;
    primaryAction: TransactionResultAction;
  }>
>;

export function TransactionResult({ tone, title, subtitle, details, actions, notice, primaryAction, children }: Props) {
  const styles = useThemedStyles(createStyles);
  const colors = {
    success: {
      screen: styles.successScreen,
      text: styles.successTone,
      mark: styles.successMark,
      button: styles.successButton,
      buttonText: styles.onToneText,
    },
    failed: {
      screen: styles.failedScreen,
      text: styles.failedTone,
      mark: styles.failedMark,
      button: styles.failedButton,
      buttonText: styles.onToneText,
    },
    unverified: {
      screen: styles.unverifiedScreen,
      text: styles.unverifiedTone,
      mark: styles.unverifiedMark,
      button: styles.unverifiedButton,
      buttonText: styles.onWarningText,
    },
  }[tone];
  return (
    <View style={[styles.screen, colors.screen]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={[styles.mark, colors.mark]}>
            <Text style={[styles.markText, colors.text]}>{tone === 'success' ? '✓' : '!'}</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.title, colors.text]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, colors.text]}>{subtitle}</Text>
        </View>
        <View style={styles.card}>
          {details.map((detail, index) => (
            <View key={`${detail.label}-${index}`} style={styles.detail}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Text style={styles.detailLabel}>{detail.label}</Text>
              <Text selectable style={styles.detailValue}>
                {detail.value}
              </Text>
            </View>
          ))}
          <View style={styles.actions}>
            {actions.map(action => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!action.disabled }}
                disabled={action.disabled}
                onPress={action.onPress}
                style={[styles.secondaryButton, action.disabled ? styles.disabled : undefined]}
              >
                <Text style={styles.secondaryText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
          {notice ? (
            <Text accessibilityLiveRegion="assertive" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          {children}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !!primaryAction.disabled }}
          disabled={primaryAction.disabled}
          onPress={primaryAction.onPress}
          style={[styles.primaryButton, colors.button, primaryAction.disabled ? styles.disabled : undefined]}
        >
          <Text style={[styles.primaryText, colors.buttonText]}>{primaryAction.label}</Text>
        </Pressable>
      </View>
    </View>
  );
}
