import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {PaymentReview} from '../../capabilities/payment/buildPaymentReview';
import {SlideToConfirm} from '../../ui/SlideToConfirm';

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
  const assetLabel =
    review.asset.kind === 'native'
      ? 'XLM'
      : `${review.asset.code}:${review.asset.issuer}`;

  return (
    <SafeAreaView style={styles.safeArea}>
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
          <ReviewRow label="Memo" value={review.memo ?? 'None'} />
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

        {passphraseRequired ? (
          <View style={styles.passphraseBlock}>
            <Text style={styles.passphraseLabel}>APP PASSPHRASE</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              onChangeText={onChangePassphrase}
              placeholder="Enter current app passphrase"
              placeholderTextColor="#ACB1C1"
              secureTextEntry
              style={styles.passphraseInput}
              value={appPassphrase}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <SlideToConfirm
          disabled={submitting || (passphraseRequired && appPassphrase.length === 0)}
          label="Slide to send"
          loading={submitting}
          onComplete={onConfirm}
        />
      </View>
    </SafeAreaView>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
}: Readonly<{label: string; value: string; mono?: boolean}>) {
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

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  headerTitle: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  content: {paddingBottom: 28},
  summaryHero: {alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24},
  summaryEyebrow: {fontSize: 10, lineHeight: 13, color: '#ACB1C1', fontWeight: '800', letterSpacing: 0.8},
  summaryAmount: {fontSize: 36, lineHeight: 44, color: '#000000', fontWeight: '700', marginTop: 5},
  summaryAsset: {fontSize: 13, lineHeight: 17, color: '#606885', fontWeight: '700', marginTop: 2, textAlign: 'center'},
  rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  reviewRow: {minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  label: {fontSize: 12, lineHeight: 16, color: '#606885', fontWeight: '600'},
  value: {flex: 1, fontSize: 12, lineHeight: 16, color: '#000000', fontWeight: '600', textAlign: 'right'},
  mono: {fontSize: 10, lineHeight: 14, color: '#606885', fontWeight: '400'},
  authorizationNote: {marginHorizontal: 18, marginTop: 20, borderRadius: 11, padding: 14, backgroundColor: '#F3F6FA', gap: 5},
  authorizationTitle: {fontSize: 12, lineHeight: 16, color: '#181D41', fontWeight: '800'},
  authorizationText: {fontSize: 10, lineHeight: 15, color: '#606885'},
  passphraseBlock: {marginHorizontal: 18, marginTop: 18, gap: 7},
  passphraseLabel: {fontSize: 10, lineHeight: 13, color: '#ACB1C1', fontWeight: '800'},
  passphraseInput: {minHeight: 52, borderRadius: 10, backgroundColor: '#F3F6FA', paddingHorizontal: 14, color: '#000000', fontSize: 14},
  error: {marginHorizontal: 18, marginTop: 14, borderRadius: 9, padding: 12, backgroundColor: 'rgba(255, 91, 91, 0.09)', color: '#FF5B5B', fontSize: 11, lineHeight: 16},
  bottomBar: {paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0', backgroundColor: '#FFFFFF'},
});
