import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { AccountRecord } from '@capabilities/account/types';
import type { ContractTransfers, ContractTransferReview } from '@capabilities/assets/contractTransfer';
import { Button, Screen } from '@ui/components';
import { CenteredPageHeader } from '@ui/components/CenteredPageHeader/CenteredPageHeader';
import { PassphrasePrompt } from '@ui/components/PassphrasePrompt/PassphrasePrompt';
import type { PassphraseInputHandle } from '@ui/components/PassphraseInput';
import { SlideToConfirm } from '@ui/SlideToConfirm';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createContractAssetStyles } from './contractAssetStyles';

type Owner = { controller: AbortController; current: () => boolean };
type Result = Readonly<{ status: 'submitted' | 'uncertain' | 'rejected'; hash: string }>;

export function ContractTransferScreen({
  account,
  contractId,
  product,
  foreground,
  captureSession,
  onBack,
  onRecover,
}: Readonly<{
  account: AccountRecord;
  contractId: string;
  product: ContractTransfers;
  foreground: boolean;
  captureSession: (focus: () => boolean) => () => boolean;
  onBack: () => void;
  onRecover: () => Promise<unknown>;
}>) {
  const { t, formatDate } = useLocalization();
  const styles = useThemedStyles(createContractAssetStyles);
  const focused = useIsFocused();
  const active = focused && foreground && AppState.currentState === 'active';
  const activeRef = useRef(active);
  activeRef.current = active;
  const focusEpoch = useRef(0);
  const renderedEpoch = focusEpoch.current;
  const operation = useRef<Owner | undefined>(undefined);
  const running = useRef(false);
  const password = useRef<PassphraseInputHandle>(null);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<ContractTransferReview>();
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [present, setPresent] = useState(false);
  const [error, setError] = useState(false);
  const retire = useCallback(() => {
    operation.current?.controller.abort();
    operation.current = undefined;
    running.current = false;
    password.current?.clear();
    setPresent(false);
    setBusy(false);
    setPrompt(false);
    setReview(undefined);
    setError(false);
  }, []);
  useFocusEffect(
    useCallback(
      () => () => {
        activeRef.current = false;
        focusEpoch.current += 1;
        retire();
      },
      [retire],
    ),
  );
  useEffect(() => {
    if (!active) retire();
  }, [active, retire]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        activeRef.current = false;
        focusEpoch.current += 1;
        retire();
      }
    });
    return () => sub.remove();
  }, [retire]);
  useEffect(() => {
    if (!review) return;
    const timer = setTimeout(retire, Math.max(0, review.expiresAtUnixSeconds! * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [review, retire]);
  const prepare = async () => {
    if (!activeRef.current || focusEpoch.current !== renderedEpoch || running.current || operation.current) return;
    const controller = new AbortController();
    const owner: Owner = { controller, current: () => false };
    operation.current = owner;
    owner.current = captureSession(
      () => activeRef.current && operation.current === owner && !controller.signal.aborted,
    );
    if (!owner.current()) {
      retire();
      return;
    }
    running.current = true;
    setBusy(true);
    setError(false);
    try {
      const prepared = await product.prepare(
        account,
        { contractId, destination, amount },
        controller.signal,
        owner.current,
      );
      if (owner.current()) setReview(prepared);
    } catch {
      if (owner.current()) {
        setError(true);
        operation.current = undefined;
      }
    } finally {
      if (operation.current === owner || operation.current === undefined) {
        running.current = false;
        setBusy(false);
      }
    }
  };
  const confirm = async () => {
    const owner = operation.current;
    if (!review || !owner?.current() || running.current) return;
    const passphrase = password.current?.consume();
    if (!passphrase) return;
    running.current = true;
    setBusy(true);
    setError(false);
    try {
      const outcome = await product.submit(review, passphrase, owner.current);
      if (!owner.current()) return;
      if (outcome.status === 'submitted' || outcome.status === 'uncertain' || outcome.status === 'rejected') {
        const hash = outcome.status === 'submitted' ? outcome.hash : outcome.transactionHash;
        retire();
        setResult({ status: outcome.status, hash });
      } else setError(true);
    } catch {
      if (owner.current()) setError(true);
    } finally {
      if (operation.current === owner) {
        running.current = false;
        setBusy(false);
      }
    }
  };
  const recover = async () => {
    if (
      !result ||
      result.status !== 'uncertain' ||
      running.current ||
      !activeRef.current ||
      focusEpoch.current !== renderedEpoch
    )
      return;
    const owner = { controller: new AbortController(), current: () => false };
    operation.current = owner;
    owner.current = captureSession(
      () => activeRef.current && operation.current === owner && !owner.controller.signal.aborted,
    );
    if (!owner.current()) {
      retire();
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      await onRecover();
      if (!owner.current()) return;
      const status = product.outcome(result.hash);
      if (status === 'confirmed' || status === 'rejected')
        setResult({ hash: result.hash, status: status === 'confirmed' ? 'submitted' : 'rejected' });
    } catch {
      if (owner.current()) setError(true);
    } finally {
      if (operation.current === owner) {
        operation.current = undefined;
        running.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Screen keyboardShouldPersistTaps="handled">
      <CenteredPageHeader
        title={t('assets.contract.transfer.title')}
        backLabel={t('common.back')}
        onBack={() => {
          retire();
          onBack();
        }}
      />
      <Text style={styles.note}>{t('assets.contract.transfer.warning')}</Text>
      <Text selectable style={styles.contractId}>
        {contractId}
      </Text>
      {result ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('assets.contract.transfer.' + result.status)}</Text>
          <Text selectable style={styles.contractId}>
            {result.hash}
          </Text>
          {result.status === 'uncertain' ? (
            <Button label={t('assets.contract.transfer.recover')} disabled={busy || !active} onPress={recover} />
          ) : null}
          <Button label={t('common.back')} onPress={onBack} />
        </View>
      ) : review ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('assets.contract.transfer.review')}</Text>
          <Text selectable style={styles.contractId}>
            {review.networkId}
          </Text>
          <Text style={styles.note}>{t('assets.contract.transfer.from')}</Text>
          <Text selectable style={styles.contractId}>
            {review.source}
          </Text>
          <Text style={styles.note}>{t('assets.contract.transfer.to')}</Text>
          <Text selectable style={styles.contractId}>
            {review.destination}
          </Text>
          <Text style={styles.balance}>{review.amount}</Text>
          <Text style={styles.note}>
            {t('assets.contract.transfer.baseUnits')}: {review.baseUnits} · {review.decimals}
          </Text>
          <Text style={styles.note}>
            {t('assets.contract.transfer.fee')}: {review.fee} stroops
          </Text>
          <Text style={styles.note}>
            {t('assets.contract.transfer.resourceFee')}: {review.resourceFee} stroops
          </Text>
          <Text style={styles.note}>
            {t('assets.contract.transfer.expires')}: {formatDate(review.expiresAtUnixSeconds! * 1000)}
          </Text>
          <Text selectable style={styles.contractId}>
            {review.hash}
          </Text>
          <SlideToConfirm
            disabled={!active || busy || prompt}
            loading={busy}
            label={t('send.authorization.slideToAuthorize')}
            onComplete={() => {
              if (operation.current?.current() && Date.now() < review.expiresAtUnixSeconds! * 1000) setPrompt(true);
              else {
                retire();
                setError(true);
              }
            }}
          />
          <Button label={t('common.back')} variant="secondary" disabled={busy} onPress={retire} />
          <PassphrasePrompt
            visible={prompt}
            active={active}
            busy={busy}
            title={t('passphrase.prompt.title')}
            label={t('send.authorization.appPassphrase')}
            hint={t('send.authorization.passphraseHint')}
            confirmLabel={t('passphrase.prompt.sign')}
            cancelLabel={t('common.cancel')}
            inputRef={password}
            hasValue={present}
            error={error ? t('assets.contract.transfer.error') : undefined}
            expiresAtUnixMs={review.expiresAtUnixSeconds! * 1000}
            onPresenceChange={setPresent}
            onConfirm={confirm}
            onCancel={() => {
              if (!running.current) {
                password.current?.clear();
                setPrompt(false);
                setError(false);
              }
            }}
            onExpire={retire}
          />
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.note}>{t('assets.contract.transfer.to')}</Text>
          <TextInput
            accessibilityLabel={t('assets.contract.transfer.to')}
            value={destination}
            onChangeText={setDestination}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={56}
            editable={!busy}
            style={styles.input}
          />
          <Text style={styles.note}>{t('assets.contract.transfer.amount')}</Text>
          <TextInput
            accessibilityLabel={t('assets.contract.transfer.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoCorrect={false}
            maxLength={80}
            editable={!busy}
            style={styles.input}
          />
          <Button
            label={busy ? t('assets.contract.loading') : t('assets.contract.transfer.review')}
            disabled={busy || !active || !destination.trim() || !amount.trim()}
            onPress={prepare}
          />
        </View>
      )}
      {error && !prompt ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('assets.contract.transfer.error')}
        </Text>
      ) : null}
    </Screen>
  );
}
