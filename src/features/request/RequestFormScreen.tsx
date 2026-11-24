import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Screen } from '../../ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { SelectField } from '@ui/components/SelectField';
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

  const content = (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton label={t('request.back')} onPress={props.onCancel} size="sm" variant="quiet" />
        </View>
        <Text style={styles.headerTitle}>{t('request.title')}</Text>
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

        <SelectField
          label={t('request.asset')}
          value={requestAssetKey(props.selectedAsset)}
          options={props.assets.map(asset => ({
            value: requestAssetKey(asset),
            label: asset.kind === 'native' ? 'XLM' : asset.code,
            description: asset.kind === 'native' ? t('assets.picker.native') : asset.issuer,
            accessibilityLabel: asset.kind === 'native'
              ? t('request.assetChoice', { asset: 'XLM' })
              : t('request.assetChoiceIssued', { code: asset.code, issuer: asset.issuer }),
          }))}
          disabled={props.busy || props.assets.length < 2}
          search={{ label: t('assets.picker.search'), emptyLabel: t('assets.picker.empty') }}
          onValueChange={key => {
            if (props.busy) return;
            const asset = props.assets.find(candidate => requestAssetKey(candidate) === key);
            if (asset && key !== requestAssetKey(props.selectedAsset)) props.onSelectAsset(asset);
          }}
        />
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
        {props.amountEnabled ? <Text style={styles.fieldHint}>{t('request.amount.hint')}</Text> : null}

        <SelectField
          label={t('request.memo')}
          value={props.memoType}
          options={(['none', 'text', 'id', 'hash', 'return'] as const).map(type => ({
            value: type,
            label: t(`request.memo.type.${type}`),
          }))}
          disabled={props.busy}
          onValueChange={type => {
            if (!props.busy && type !== props.memoType) props.onSelectMemoType(type);
          }}
        />
        {props.memoType !== 'none' ? (
          <View style={styles.fieldBox}>
            <TextInput
              accessibilityLabel={t(`request.memo.input.${props.memoType}`)}
              autoCapitalize={props.memoType === 'hash' || props.memoType === 'return' ? 'characters' : 'none'}
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
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t('request.ingress.section')}</Text>
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
      {content}
    </KeyboardAvoidingView>
  );
}

export { formatPublicAddress as maskRequestIssuer } from '@ui/formatPublicAddress';

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
      <Text style={[styles.actionText, secondary ? styles.secondaryActionText : undefined]}>{label}</Text>
    </Pressable>
  );
}
