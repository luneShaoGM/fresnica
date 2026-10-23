import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useThemedStyles } from '@ui/theme';

import { createStyles } from './styles';

export type TransactionResultTone = 'success' | 'failed' | 'unverified' | 'queued' | 'signed';

export type TransactionResultDetail = Readonly<{
  label: string;
  value: string;
  copyLabel?: string;
}>;

export type TransactionResultAction = Readonly<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
}>;

export type TransactionResultProps = Readonly<{
  tone: TransactionResultTone;
  title: string;
  subtitle: string;
  highlight?: string;
  details?: readonly TransactionResultDetail[];
  onCopy?: (value: string) => void;
  actions?: readonly TransactionResultAction[];
  notice?: string;
  primaryAction: TransactionResultAction;
}>;

const markGlyph: Record<TransactionResultTone, string> = {
  success: '✓',
  failed: '!',
  unverified: '!',
  queued: '…',
  signed: '✓',
};

export function TransactionResult({
  tone,
  title,
  subtitle,
  highlight,
  details = [],
  onCopy,
  actions = [],
  notice,
  primaryAction,
}: TransactionResultProps): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  const toneStyle = tonePresentation(styles, tone);
  const showCard = details.length > 0 || actions.length > 0 || notice !== undefined;

  return (
    <View style={[styles.screen, toneStyle.screen]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={[styles.mark, toneStyle.mark]}>
            <Text style={[styles.markText, toneStyle.tone]}>{markGlyph[tone]}</Text>
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.title, toneStyle.tone]}>
            {title}
          </Text>
          <Text style={[styles.subtitle, toneStyle.tone]}>{subtitle}</Text>
          {highlight ? <Text style={styles.highlight}>{highlight}</Text> : null}
        </View>
        {showCard ? (
          <View style={styles.card}>
            {details.map((detail, index) => (
              <ResultDetail
                copyLabel={detail.copyLabel}
                key={`${detail.label}-${index}`}
                label={detail.label}
                onCopy={detail.copyLabel && onCopy ? () => onCopy(detail.value) : undefined}
                separated={index > 0}
                value={detail.value}
              />
            ))}
            {actions.length > 0 ? (
              <View style={styles.actions}>
                {actions.map(action => (
                  <Pressable
                    accessibilityRole="button"
                    disabled={action.disabled}
                    key={action.label}
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && !action.disabled ? styles.pressed : undefined,
                      action.disabled ? styles.disabled : undefined,
                    ]}
                  >
                    <Text style={styles.secondaryText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {notice ? (
              <Text accessibilityLiveRegion="assertive" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={primaryAction.disabled}
          onPress={primaryAction.onPress}
          style={({ pressed }) => [
            styles.primaryButton,
            toneStyle.button,
            pressed && !primaryAction.disabled ? styles.pressed : undefined,
            primaryAction.disabled ? styles.disabled : undefined,
          ]}
        >
          <Text style={[styles.primaryText, toneStyle.buttonText]}>{primaryAction.label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultDetail({
  label,
  value,
  copyLabel,
  onCopy,
  separated,
}: Readonly<{
  label: string;
  value: string;
  copyLabel?: string;
  onCopy?: () => void;
  separated: boolean;
}>): React.JSX.Element {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detail}>
      {separated ? <View style={styles.divider} /> : null}
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value}
      </Text>
      {copyLabel && onCopy ? (
        <Pressable accessibilityRole="button" onPress={onCopy} style={styles.copyButton}>
          <Text style={styles.copyText}>{copyLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function tonePresentation(styles: ReturnType<typeof createStyles>, tone: TransactionResultTone) {
  switch (tone) {
    case 'success':
      return {
        screen: styles.successScreen,
        tone: styles.successTone,
        mark: styles.successMark,
        button: styles.successButton,
        buttonText: styles.onToneText,
      };
    case 'failed':
      return {
        screen: styles.failedScreen,
        tone: styles.failedTone,
        mark: styles.failedMark,
        button: styles.failedButton,
        buttonText: styles.onToneText,
      };
    case 'unverified':
      return {
        screen: styles.unverifiedScreen,
        tone: styles.unverifiedTone,
        mark: styles.unverifiedMark,
        button: styles.unverifiedButton,
        buttonText: styles.onWarningText,
      };
    case 'queued':
      return {
        screen: styles.queuedScreen,
        tone: styles.queuedTone,
        mark: styles.queuedMark,
        button: styles.queuedButton,
        buttonText: styles.onToneText,
      };
    case 'signed':
      return {
        screen: styles.signedScreen,
        tone: styles.signedTone,
        mark: styles.signedMark,
        button: styles.signedButton,
        buttonText: styles.onToneText,
      };
  }
}
