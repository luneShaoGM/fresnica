import { type PassphraseInputHandle } from '@ui/components/PassphraseInput';
import React, { useState } from 'react';
import { PassphrasePrompt } from '../../ui/components/PassphrasePrompt/PassphrasePrompt';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';

import type { PaymentReview } from '../../capabilities/payment/buildPaymentReview';
import { useLocalization } from '../../locale';
import { useThemedStyles } from '../../ui/theme';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { createSendReviewStyles } from './styles';

type Props = Readonly<{
  active?: boolean;
  onCancelAuthorization?: () => void;
  recipientCard?: React.ReactNode;
  review: PaymentReview;
  submitting: boolean;
  passphraseRequired: boolean;
  passphraseInput: React.RefObject<PassphraseInputHandle | null>;
  hasPassphrase: boolean;
  error?: string;
  onPassphrasePresenceChange: (value: boolean) => void;
  onConfirm: () => void;
  onBack: () => void;
}>;

export function SendReviewScreen({
  review,
  active = true,
  onCancelAuthorization,
  recipientCard,
  submitting,
  passphraseRequired,
  passphraseInput,
  hasPassphrase,
  error,
  onPassphrasePresenceChange,
  onConfirm,
  onBack,
}: Props) {
  const [authorizing, setAuthorizing] = useState(false);
  const { t } = useLocalization();
  const styles = useThemedStyles(createSendReviewStyles);
  const memoLabel =
    review.memo === undefined
      ? t('send.memo.type.none')
      : `${t(`send.memo.type.${review.memo.type}`)} · ${review.memo.value}`;
  const assetLabel = review.asset.kind === 'native' ? 'XLM' : `${review.asset.code}:${review.asset.issuer}`;

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" disabled={submitting} onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('send.step.summary')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryHero}>
          <Text style={styles.summaryEyebrow}>{review.operation === 'create-account' ? 'CREATE ACCOUNT' : 'SEND'}</Text>
          <Text style={styles.summaryAmount}>{review.amount}</Text>
          <Text style={styles.summaryAsset}>{assetLabel}</Text>
        </View>

        {recipientCard}
        <View style={styles.rows}>
          <ReviewRow label="Operation" value={review.operation === 'create-account' ? 'CreateAccount' : 'Payment'} />
          <ReviewRow label="From" value={review.source} mono />
          <ReviewRow label="To" value={review.destination} mono />
          <ReviewRow
            label="Memo"
            value={memoLabel}
            mono={review.memo?.type === 'hash' || review.memo?.type === 'return'}
          />
          <ReviewRow label="Fee" value={`${review.fee} stroops`} />
          {review.expiresAtUnixSeconds === undefined ? null : (
            <ReviewRow label="Expires" value={new Date(review.expiresAtUnixSeconds * 1000).toLocaleString()} />
          )}
        </View>
      </ScrollView>

      {error && !authorizing ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <PassphrasePrompt
        visible={authorizing}
        active={active}
        busy={submitting}
        title={t('passphrase.prompt.title')}
        label={t('send.authorization.appPassphrase')}
        hint={t('send.authorization.passphraseHint')}
        confirmLabel={t('passphrase.prompt.sign')}
        cancelLabel={t('common.cancel')}
        inputRef={passphraseInput}
        hasValue={hasPassphrase}
        error={error}
        expiresAtUnixMs={review.expiresAtUnixSeconds === undefined ? undefined : review.expiresAtUnixSeconds * 1000}
        onExpire={() => {
          passphraseInput.current?.clear();
          setAuthorizing(false);
          onBack();
        }}
        onPresenceChange={onPassphrasePresenceChange}
        onConfirm={onConfirm}
        onCancel={() => {
          passphraseInput.current?.clear();
          setAuthorizing(false);
          onCancelAuthorization?.();
        }}
      />

      <View style={styles.bottomBar}>
        <SlideToConfirm
          disabled={submitting || authorizing || !active}
          label={t('send.authorization.slideToAuthorize')}
          loading={submitting}
          onComplete={() => {
            if (passphraseRequired) setAuthorizing(true);
            else onConfirm();
          }}
        />
      </View>
    </Screen>
  );
}

function ReviewRow({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  const styles = useThemedStyles(createSendReviewStyles);

  return (
    <View style={styles.reviewRow}>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={mono ? 2 : 3} selectable style={[styles.value, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}
