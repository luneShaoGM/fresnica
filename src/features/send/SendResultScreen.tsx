import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {Screen} from '@ui/components';
import {contrastText} from '@ui/theme/appearanceTheme';
import {NativeButton} from '@ui/components/NativeButton';

import {useLocalization} from '../../locale';
import {useThemedStyles, type AppTheme} from '../../ui/theme';
import type {SendSubmissionResult} from './sendProductFlow';

export type SendTerminalResult = Exclude<
  SendSubmissionResult,
  {status: 'passphrase-required'}
>;

type Props = Readonly<{
  recipientCard?: React.ReactNode;
  result: SendTerminalResult;
  onDone: () => void;
}>;

export function SendResultScreen({result, onDone, recipientCard}: Props) {
  const styles = useThemedStyles(createStyles);
  const {t} = useLocalization();
  const positive = result.status === 'submitted';
  const uncertain = result.status === 'uncertain';

  return (
    <Screen scrollable={false} contentInset="none">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.resultHero}>
          <View
            style={[
              styles.resultIcon,
              positive ? styles.resultIconPositive : uncertain ? styles.resultIconUncertain : styles.resultIconNegative,
            ]}>
            <Text style={[styles.resultGlyph, positive ? styles.resultGlyphPositive : uncertain ? styles.resultGlyphUncertain : styles.resultGlyphNegative]}>{positive ? '✓' : uncertain ? '?' : '!'}</Text>
          </View>
          <Text style={styles.title}>{t(`send.result.${result.status}.title`)}</Text>
          <Text style={styles.description}>{t(`send.result.${result.status}.description`)}</Text>
        </View>

        {recipientCard}
        {'hash' in result ? <ResultRow label={t('send.result.hash')} value={result.hash} mono /> : null}
        {'transactionHash' in result ? (
          <ResultRow label={t('send.result.hash')} value={result.transactionHash} mono />
        ) : null}
        {result.status === 'submitted' && result.ledger !== undefined ? (
          <ResultRow label={t('send.result.ledger')} value={String(result.ledger)} />
        ) : null}
        {result.status === 'rejected' && result.resultCode ? (
          <ResultRow label={t('send.result.code')} value={result.resultCode} mono />
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <NativeButton label={t('send.navigation.done')} onPress={onDone} size="lg" variant="primary" />
      </View>
    </Screen>
  );
}

function ResultRow({label, value, mono = false}: Readonly<{label: string; value: string; mono?: boolean}>) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text selectable style={[styles.rowValue, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: theme.colors.background},
    content: {flexGrow: 1, paddingBottom: 24},
    resultHero: {alignItems: 'center', paddingHorizontal: 28, paddingTop: 60, paddingBottom: 36, gap: 10},
    resultIcon: {width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginBottom: 8},
    resultIconPositive: {backgroundColor: theme.colors.positive},
    resultIconNegative: {backgroundColor: theme.colors.negative},
    resultIconUncertain: {backgroundColor: theme.colors.warning},
    resultGlyph: {fontSize: 34, lineHeight: 39, fontWeight: '800'},
    resultGlyphPositive: {color: contrastText(theme.colors.positive)},
    resultGlyphUncertain: {color: contrastText(theme.colors.warning)},
    resultGlyphNegative: {color: contrastText(theme.colors.negative)},
    title: {fontSize: 23, lineHeight: 28, color: theme.colors.textPrimary, fontWeight: '800', textAlign: 'center'},
    description: {fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center'},
    row: {
      minHeight: 57,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    rowLabel: {maxWidth: '40%', flexShrink: 1, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, fontWeight: '600'},
    rowValue: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textPrimary,
      fontWeight: '600',
      textAlign: 'right',
    },
    mono: {fontSize: 10, lineHeight: 14, color: theme.colors.textSecondary, fontWeight: '400'},
    bottomBar: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
  });
}
