import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import { Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import type { AccountRecord } from '@capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import type { AssetCatalogPort, CuratedContractName } from '@capabilities/trustline/curatedAssetCatalog';
import {
  formatContractBalance,
  type ContractAssets,
  type ContractTokenRecord,
} from '@capabilities/assets/contractAssets';
import { useLocalization } from '../../locale';
import { useBalanceDisplay } from '../home/useBalanceDisplay';
import { createContractAssetStyles } from './contractAssetStyles';

type Props = Readonly<{
  account: AccountRecord;
  product: ContractAssets;
  active: boolean;
  isCurrent: () => boolean;
  balanceDependencies: BalanceProductDependencies;
  catalog: AssetCatalogPort;
  invalidationRevision: number;
  onTransfer?: (contractId: string) => void;
}>;

export function ContractAssetsPanel({
  account,
  product,
  active,
  isCurrent,
  balanceDependencies,
  catalog,
  invalidationRevision,
  onTransfer,
}: Props) {
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
  const catalogOperation = useRef<AbortController | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<readonly CuratedContractName[]>();
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const balance = useBalanceDisplay(account, balanceDependencies, active && isCurrent(), invalidationRevision).state;
  const classicLines =
    balance.kind === 'ready' && !balance.stale && balance.snapshot.status === 'active' ? balance.snapshot.balances : [];
  const mirrors =
    active && isCurrent()
      ? product.classicMirrors(
          account,
          classicLines.map(line => line.asset),
        )
      : [];
  const mirrorById = new Map(mirrors.map(mirror => [mirror.contractId, mirror.asset]));
  const live = () => active && AppState.currentState === 'active' && isCurrent();
  useEffect(() => {
    setSnapshot(undefined);
    setInput('');
    setBusy(false);
    setError(false);
    setSuggestions(undefined);
    setCatalogFailed(false);
    setCatalogBusy(false);
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
      catalogOperation.current?.abort();
      catalogOperation.current = undefined;
    };
  }, [active, product, account.id, account.address, account.networkId, account.hidden, account.identityKind]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        operation.current?.abort();
        operation.current = undefined;
        catalogOperation.current?.abort();
        catalogOperation.current = undefined;
        setBusy(false);
        setCatalogBusy(false);
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
  const loadSuggestions = async () => {
    if (!live() || catalogOperation.current || !catalog.loadSource || account.networkId !== 'stellar-mainnet') return;
    const owner = new AbortController();
    catalogOperation.current = owner;
    setCatalogBusy(true);
    setCatalogFailed(false);
    try {
      const source = await catalog.loadSource(account.networkId, 'soroswap', owner.signal);
      if (catalogOperation.current !== owner || owner.signal.aborted || !live()) return;
      setSuggestions((source.contractNames ?? []).filter(row => product.isContractId(row.contractId)));
      setCatalogFailed(source.refreshFailed || source.stale);
    } catch {
      if (catalogOperation.current === owner && !owner.signal.aborted && live()) setCatalogFailed(true);
    } finally {
      if (catalogOperation.current === owner) {
        catalogOperation.current = undefined;
        setCatalogBusy(false);
      }
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
      <Text style={styles.note}>{t('assets.contract.mirrorExplanation')}</Text>
      {mirrors
        .filter(mirror => !visibleRows.some(row => row.contractId === mirror.contractId))
        .map(mirror => (
          <View style={styles.card} key={mirror.contractId}>
            <Text style={styles.title}>
              {mirror.asset.code} · {t('assets.contract.classicMirror')}
            </Text>
            {mirror.asset.kind === 'credit' ? (
              <Text selectable style={styles.contractId}>
                {mirror.asset.issuer}
              </Text>
            ) : null}
            <Text selectable style={styles.contractId}>
              {mirror.contractId}
            </Text>
          </View>
        ))}
      {classicLines.length === 0 ? <Text style={styles.note}>{t('assets.contract.noClassicSnapshot')}</Text> : null}
      {account.networkId === 'stellar-mainnet' ? (
        <>
          <Button
            label={catalogBusy ? t('assets.contract.loading') : t('assets.contract.searchCatalog')}
            disabled={catalogBusy}
            onPress={loadSuggestions}
          />
          {catalogFailed ? <Text style={styles.note}>{t('assets.contract.catalogUnavailable')}</Text> : null}
          {suggestions ? <Text style={styles.note}>{t('assets.contract.catalogWarning')}</Text> : null}
          {suggestions
            ?.filter(row => `${row.name} ${row.contractId}`.toLowerCase().includes(input.trim().toLowerCase()))
            .slice(0, 20)
            .map(row => (
              <Button
                key={row.contractId}
                label={`${row.name} · ${row.contractId.slice(0, 8)}…`}
                variant="secondary"
                disabled={busy}
                onPress={() => setInput(row.contractId)}
              />
            ))}
          {suggestions?.length === 0 ? <Text style={styles.note}>{t('assets.contract.noCatalog')}</Text> : null}
        </>
      ) : null}
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
          {mirrorById.has(record.contractId) ? (
            <Text style={styles.note}>
              {t('assets.contract.classicMirror')} · {mirrorById.get(record.contractId)?.code}
            </Text>
          ) : (
            <Text style={styles.note}>{t('assets.contract.independentTracked')}</Text>
          )}
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
          {onTransfer ? <Button label={t('assets.contract.transfer.title')} disabled={busy}
            onPress={() => { if (live() && !operation.current) onTransfer(record.contractId); }} /> : null}
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
