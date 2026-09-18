import React from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Screen} from '@ui/components';

import type {PaymentReview} from '../../capabilities/payment/buildPaymentReview';
import {useLocalization} from '../../locale';
import {useAppTheme, useThemedStyles} from '../../ui/theme';
import {SlideToConfirm} from '../../ui/SlideToConfirm';
import {createSendReviewStyles} from './styles';

type Props = Readonly<{
  review: PaymentReview;
  submitting: boolean;
  passphraseRequired: boolean;
  appPassphrase: string;
  error?: string;
  onChangePassphrase: (value: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}>;

export function SendReviewScreen({
  review,
  submitting,
  passphraseRequired,
  appPassphrase,
  error,
  onChangePassphrase,
  onConfirm,
  onBack,
}: Props) {
  const theme = useAppTheme();
  const {t} = useLocalization();
  const styles = useThemedStyles(createSendReviewStyles);
  const memoLabel =
    review.memo === undefined
      ? t('send.memo.type.none')
      : `${t(`send.memo.type.${review.memo.type}`)} · ${review.memo.value}`;
  const assetLabel =
    review.asset.kind === 'native'
      ? 'XLM'
      : `${review.asset.code}:${review.asset.issuer}`;

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          disabled={submitting}
          onPress={onBack}
          style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Review</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.summaryHero}>
          <Text style={styles.summaryEyebrow}>
            {review.operation === 'create-account' ? 'CREATE ACCOUNT' : 'SEND'}
          </Text>
          <Text style={styles.summaryAmount}>{review.amount}</Text>
          <Text style={styles.summaryAsset}>{assetLabel}</Text>
        </View>

        <View style={styles.rows}>
          <ReviewRow
            label="Operation"
            value={review.operation === 'create-account' ? 'CreateAccount' : 'Payment'}
          />
          <ReviewRow label="From" value={review.source} mono />
          <ReviewRow label="To" value={review.destination} mono />
          <ReviewRow label="Memo" value={memoLabel} mono={review.memo?.type === 'hash'} />
          <ReviewRow label="Fee" value={`${review.fee} stroops`} />
          {review.expiresAtUnixSeconds === undefined ? null : (
            <ReviewRow
              label="Expires"
              value={new Date(review.expiresAtUnixSeconds * 1000).toLocaleString()}
            />
          )}
        </View>

        <View style={styles.authorizationNote}>
          <Text style={styles.authorizationTitle}>Authorization</Text>
          <Text style={styles.authorizationText}>
            Fresnica reloads current ledger authorization before signing. System Auth is used first when enrolled; otherwise the app passphrase is requested here.
          </Text>
        </View>

      </ScrollView>

      {error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {passphraseRequired ? (
        <View style={styles.passphraseBlock}>
          <Text accessibilityLiveRegion="assertive" style={styles.passphrasePrompt}>
            {t('send.authorization.passphraseRequired')}
          </Text>
          <Text style={styles.passphraseLabel}>{t('send.authorization.appPassphrase')}</Text>
          <TextInput
            accessibilityHint={t('send.authorization.passphraseHint')}
            accessibilityLabel={t('send.authorization.appPassphrase')}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!submitting}
            onChangeText={onChangePassphrase}
            placeholder="Enter current app passphrase"
            placeholderTextColor={theme.colors.textTertiary}
            secureTextEntry
            style={styles.passphraseInput}
            value={appPassphrase}
          />
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        <SlideToConfirm
          disabled={submitting || (passphraseRequired && appPassphrase.length === 0)}
          label={passphraseRequired ? t('send.authorization.slideToAuthorize') : 'Slide to send'}
          loading={submitting}
          onComplete={onConfirm}
        />
      </View>
    </Screen>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: Readonly<{label: string; value: string; mono?: boolean}>) {
  const styles = useThemedStyles(createSendReviewStyles);

  return (
    <View style={styles.reviewRow}>
      <Text style={styles.label}>{label}</Text>
      <Text
        numberOfLines={mono ? 2 : 3}
        selectable
        style={[styles.value, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}
