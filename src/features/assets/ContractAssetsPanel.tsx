import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import { Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import type { AccountRecord } from '@capabilities/account/types';
import {
  formatContractBalance,
  type ContractAssets,
  type ContractTokenRecord,
} from '@capabilities/assets/contractAssets';
import { useLocalization } from '../../locale';
import { createContractAssetStyles } from './contractAssetStyles';

type Props = Readonly<{
  account: AccountRecord;
  product: ContractAssets;
  active: boolean;
  isCurrent: () => boolean;
}>;

export function ContractAssetsPanel({ account, product, active, isCurrent }: Props) {
  const { t, formatDate } = useLocalization();
  const styles = useThemedStyles(createContractAssetStyles);
  const [input, setInput] = useState('');
  const [snapshot, setSnapshot] =
    useState<Readonly<{ source: ContractAssets; accountId: string; rows: readonly ContractTokenRecord[] }>>();
  const accountRef = useRef(account);
  accountRef.current = account;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const operation = useRef<AbortController | undefined>(undefined);
  const live = () => active && AppState.currentState === 'active' && isCurrent();
  useEffect(() => {
    setSnapshot(undefined);
    setInput('');
    setBusy(false);
    setError(false);
    if (active) {
      try {
        setSnapshot({ source: product, accountId: accountRef.current.id, rows: product.list(accountRef.current) });
      } catch {
        setError(true);
      }
    }
    return () => {
      operation.current?.abort();
      operation.current = undefined;
    };
  }, [active, product, account.id, account.address, account.networkId, account.hidden, account.identityKind]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        operation.current?.abort();
        operation.current = undefined;
        setBusy(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const run = async (action: 'track' | 'refresh', contractId: string) => {
    if (!live() || operation.current) return;
    const owner = new AbortController();
    operation.current = owner;
    const current = () => operation.current === owner && !owner.signal.aborted && live();
    setBusy(true);
    setError(false);
    try {
      if (action === 'track') await product.track(account, contractId, owner.signal, current);
      else await product.refresh(account, contractId, owner.signal, current);
      if (!current()) return;
      setSnapshot({ source: product, accountId: account.id, rows: product.list(account) });
      if (action === 'track') setInput('');
    } catch {
      if (current()) setError(true);
    } finally {
      if (operation.current === owner) {
        operation.current = undefined;
        setBusy(false);
      }
    }
  };
  const remove = (contractId: string) => {
    if (!live() || operation.current) return;
    try {
      product.remove(account, contractId);
      setSnapshot({ source: product, accountId: account.id, rows: product.list(account) });
      setError(false);
    } catch {
      setError(true);
    }
  };
  if (!active || !isCurrent()) return null;
  const visibleRows =
    snapshot?.source === product && snapshot.accountId === account.id
      ? snapshot.rows.filter(row => row.accountAddress === account.address && row.networkId === account.networkId)
      : [];
  return (
    <View style={styles.panel}>
      <Text style={styles.note}>{t('assets.contract.explanation')}</Text>
      <Text style={styles.note}>{t('assets.contract.privacy')}</Text>
      <TextInput
        accessibilityLabel={t('assets.contract.id')}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={128}
        editable={!busy}
        placeholder={t('assets.contract.id')}
        value={input}
        onChangeText={setInput}
        style={styles.input}
      />
      <Button
        label={busy ? t('assets.contract.loading') : t('assets.contract.track')}
        disabled={busy || !/^C[A-Z2-7]{55}$/.test(input.trim())}
        onPress={() => {
          run('track', input.trim());
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t('assets.contract.error')}
        </Text>
      ) : null}
      {visibleRows.length === 0 ? <Text style={styles.note}>{t('assets.contract.empty')}</Text> : null}
      {visibleRows.map(record => (
        <View style={styles.card} key={record.contractId}>
          <Text style={styles.title}>
            {record.metadata.symbol} · {record.metadata.name}
          </Text>
          <Text selectable style={styles.contractId}>
            {record.contractId}
          </Text>
          <Text style={styles.balance}>
            {record.balance
              ? formatContractBalance(record.balance.baseUnits, record.metadata.decimals)
              : t('assets.contract.unknown')}
          </Text>
          {record.balance ? (
            <Text style={styles.note}>
              {t('assets.contract.lastObserved')}: {formatDate(record.balance.observedAt)}
            </Text>
          ) : null}
          {record.balanceUnavailable ? (
            <Text style={styles.note}>{t('assets.contract.balanceUnavailable')}</Text>
          ) : null}
          <Button
            label={t('assets.contract.refresh')}
            variant="secondary"
            disabled={busy}
            onPress={() => {
              run('refresh', record.contractId);
            }}
          />
          <Button
            label={t('assets.contract.remove')}
            variant="ghost"
            disabled={busy}
            onPress={() => remove(record.contractId)}
          />
        </View>
      ))}
    </View>
  );
}
