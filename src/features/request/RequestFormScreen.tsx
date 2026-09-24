import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '../../ui/components';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../../capabilities/stellar/types';
import { requestAssetKey } from './requestProductFlow';
import { createRequestStyles } from './styles';

type Props = Readonly<{
  accountLabel: string;
  accountAddress: string;
  assets: readonly StellarPaymentAsset[];
  selectedAsset: StellarPaymentAsset;
  assetWarning?: string;
  amountEnabled: boolean;
  amount: string;
  memoType: 'none' | StellarPaymentMemo['type'];
  memoValue: string;
  message: string;
  canonicalUri?: string;
  error?: string;
  status?: string;
  qrVisible: boolean;
  busy: boolean;
  onSelectAsset: (asset: StellarPaymentAsset) => void;
  onSetAmountEnabled: (enabled: boolean) => void;
  onChangeAmount: (value: string) => void;
  onSelectMemoType: (type: 'none' | StellarPaymentMemo['type']) => void;
  onChangeMemoValue: (value: string) => void;
  onChangeMessage: (value: string) => void;
  onCopy: () => void;
  onShare: () => void;
  onToggleQr: () => void;
  onPasteRequest: () => void;
  onScanRequest: () => void;
  onCancel: () => void;
}>;

export function RequestFormScreen(props: Props) {
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createRequestStyles);
  const actionsEnabled = props.canonicalUri !== undefined && !props.busy;

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel={t('request.back')} onPress={props.onCancel} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t('request.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.accountLabel}>{t('request.receiveTo', { label: props.accountLabel })}</Text>
        <View style={styles.addressBox}>
          <Text style={styles.addressTitle}>{t('request.address')}</Text>
          <Text
            accessibilityLabel={t('request.addressAccessibility', { address: props.accountAddress })}
            selectable
            style={styles.address}
          >
            {props.accountAddress}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{t('request.asset')}</Text>
        <ScrollView contentContainerStyle={styles.assetList} horizontal showsHorizontalScrollIndicator={false}>
          {props.assets.map(asset => {
            const selected = requestAssetKey(asset) === requestAssetKey(props.selectedAsset);
            const label = asset.kind === 'native' ? 'XLM' : asset.code;
            const accessibilityLabel =
              asset.kind === 'native'
                ? t('request.assetChoice', { asset: label })
                : t('request.assetChoiceIssued', { code: asset.code, issuer: asset.issuer });
            return (
              <Pressable
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={props.busy}
                key={requestAssetKey(asset)}
                onPress={() => props.onSelectAsset(asset)}
                style={({ pressed }) => [
                  styles.assetButton,
                  selected ? styles.assetButtonSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.assetText, selected ? styles.assetTextSelected : undefined]}>{label}</Text>
                {asset.kind === 'credit' ? (
                  <Text
                    accessibilityElementsHidden
                    numberOfLines={1}
                    style={[styles.assetIssuer, selected ? styles.assetIssuerSelected : undefined]}
                  >
                    {maskRequestIssuer(asset.issuer)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        {props.assetWarning ? <Text style={styles.warning}>{props.assetWarning}</Text> : null}

        <Text style={styles.sectionLabel}>{t('request.amount')}</Text>
        <View style={styles.optionRow}>
          {[false, true].map(enabled => {
            const selected = props.amountEnabled === enabled;
            return (
              <Pressable
                accessibilityLabel={enabled ? t('request.amount.fixed') : t('request.amount.open')}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={props.busy}
                key={String(enabled)}
                onPress={() => props.onSetAmountEnabled(enabled)}
                style={({ pressed }) => [
                  styles.optionButton,
                  selected ? styles.optionButtonSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : undefined]}>
                  {enabled ? t('request.amount.fixed') : t('request.amount.open')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {props.amountEnabled ? (
          <View style={styles.fieldBox}>
            <TextInput
              accessibilityLabel={t('request.amount.input')}
              editable={!props.busy}
              keyboardType="decimal-pad"
              onChangeText={props.onChangeAmount}
              placeholder={t('request.amount.placeholder')}
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.fieldInput}
              value={props.amount}
            />
          </View>
        ) : null}
        <Text style={styles.fieldHint}>{t('request.amount.hint')}</Text>

        <Text style={styles.sectionLabel}>{t('request.memo')}</Text>
        <View style={styles.optionRow}>
          {(['none', 'text', 'id', 'hash'] as const).map(type => {
            const selected = props.memoType === type;
            return (
              <Pressable
                accessibilityLabel={t(`request.memo.type.${type}`)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={props.busy}
                key={type}
                onPress={() => props.onSelectMemoType(type)}
                style={({ pressed }) => [
                  styles.optionButton,
                  selected ? styles.optionButtonSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <Text style={[styles.optionText, selected ? styles.optionTextSelected : undefined]}>
                  {t(`request.memo.type.${type}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {props.memoType !== 'none' ? (
          <View style={styles.fieldBox}>
            <TextInput
              accessibilityLabel={t(`request.memo.input.${props.memoType}`)}
              autoCapitalize={props.memoType === 'hash' ? 'characters' : 'none'}
              autoCorrect={false}
              editable={!props.busy}
              keyboardType={props.memoType === 'id' ? 'number-pad' : 'default'}
              onChangeText={props.onChangeMemoValue}
              placeholder={t(`request.memo.placeholder.${props.memoType}`)}
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.fieldInput}
              value={props.memoValue}
            />
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t('request.message')}</Text>
        <View style={styles.fieldBox}>
          <TextInput
            accessibilityLabel={t('request.message.input')}
            editable={!props.busy}
            maxLength={300}
            multiline
            onChangeText={props.onChangeMessage}
            placeholder={t('request.message.placeholder')}
            placeholderTextColor={theme.colors.textTertiary}
            style={styles.messageInput}
            value={props.message}
          />
        </View>
        <Text style={styles.fieldHint}>{t('request.message.hint')}</Text>

        {props.error ? (
          <Text accessibilityLiveRegion="assertive" style={styles.error}>
            {props.error}
          </Text>
        ) : null}
        {props.status ? (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {props.status}
          </Text>
        ) : null}

        {props.canonicalUri ? (
          <View style={styles.uriBox}>
            <Text style={styles.uriLabel}>{t('request.uri')}</Text>
            <Text selectable style={styles.uri}>
              {props.canonicalUri}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <RequestAction label={t('request.copy')} disabled={!actionsEnabled} onPress={props.onCopy} styles={styles} />
          <RequestAction
            label={t('request.share')}
            disabled={!actionsEnabled}
            onPress={props.onShare}
            styles={styles}
          />
          <RequestAction
            label={props.qrVisible ? t('request.qr.hide') : t('request.qr.show')}
            disabled={!actionsEnabled}
            onPress={props.onToggleQr}
            secondary
            styles={styles}
          />
        </View>

        {props.qrVisible && props.canonicalUri ? (
          <View
            accessible
            accessibilityLabel={t('request.qr.accessibility', {
              address: props.accountAddress,
              uri: props.canonicalUri,
            })}
            style={styles.qrPanel}
          >
            <QRCode
              backgroundColor={theme.colors.surface}
              color={theme.colors.textPrimary}
              size={210}
              value={props.canonicalUri}
            />
            <Text style={styles.qrText}>{props.canonicalUri}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t('request.ingress.section')}</Text>
        <Text style={styles.fieldHint}>{t('request.ingress.helper')}</Text>
        <View style={styles.actions}>
          <RequestAction
            label={t('request.ingress.paste')}
            disabled={props.busy}
            onPress={props.onPasteRequest}
            styles={styles}
          />
          <RequestAction
            label={t('request.ingress.scan')}
            disabled={props.busy}
            onPress={props.onScanRequest}
            secondary
            styles={styles}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

export function maskRequestIssuer(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

type ActionStyles = ReturnType<typeof createRequestStyles>;

function RequestAction({
  label,
  disabled,
  onPress,
  secondary = false,
  styles,
}: Readonly<{ label: string; disabled: boolean; onPress: () => void; secondary?: boolean; styles: ActionStyles }>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary ? styles.secondaryActionButton : undefined,
        disabled ? styles.actionDisabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}
