import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import type {AccountRecord} from '@capabilities/account/types';
import {loadBalanceSnapshot, type BalanceDependencies} from '@capabilities/balance/loadBalanceSnapshot';
import type {BalanceAsset} from '@capabilities/balance/types';
import {Button, Header, Screen, StateView} from '@ui/components';
import {useThemedStyles} from '@ui/theme';

import {projectFeatureError} from '../featureError';
import {createStyles} from './AssetDetailsScreen.styles';
import {resolveAssetDetailsSnapshot, type AssetDetailsSnapshotState} from './assetDetails';

type LoadState = Readonly<{kind: 'loading'}> | Readonly<{kind: 'error'; message: string}> | AssetDetailsSnapshotState;

type Props = Readonly<{
  account: AccountRecord;
  asset: BalanceAsset;
  dependencies: BalanceDependencies;
  active: boolean;
  onBack: () => void;
}>;

export function AssetDetailsScreen({account, asset, dependencies, active, onBack}: Props) {
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<LoadState>({kind: 'loading'});
  const requestVersion = useRef(0);

  const load = useCallback(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setState({kind: 'loading'});

    void loadBalanceSnapshot(dependencies, account)
      .then(snapshot => {
        if (requestVersion.current === version) {
          setState(resolveAssetDetailsSnapshot(snapshot, asset));
        }
      })
      .catch(error => {
        if (requestVersion.current === version) {
          setState({
            kind: 'error',
            message: projectFeatureError(error, {
              fallbackMessage: 'Unable to load the current asset balance.',
              fallbackRetryable: true,
            }).message,
          });
        }
      });
  }, [account, asset, dependencies]);

  useEffect(() => {
    if (!active) {
      return;
    }

    load();
    return () => {
      requestVersion.current += 1;
    };
  }, [active, load]);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.headerBar}>
        <Header
          title="Asset details"
          leading={
            <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
          }
        />
      </View>
      <View style={styles.content}>{renderContent(state, asset, account, load, styles)}</View>
    </Screen>
  );
}

type Styles = ReturnType<typeof createStyles>;

function renderContent(
  state: LoadState,
  asset: BalanceAsset,
  account: AccountRecord,
  onRefresh: () => void,
  styles: Styles,
) {
  switch (state.kind) {
    case 'loading':
      return <StateView kind="loading" title="Loading asset" message="Refreshing current network balance…" />;
    case 'error':
      return (
        <StateView
          kind="error"
          title="Asset unavailable"
          message={state.message}
          actionLabel="Try again"
          onAction={onRefresh}
        />
      );
    case 'inactive':
      return (
        <StateView
          kind="empty"
          title="Account not activated"
          message="This account does not currently exist on the configured Stellar network."
          actionLabel="Refresh"
          onAction={onRefresh}
        />
      );
    case 'unsupported-account':
      return (
        <StateView
          kind="empty"
          title="Asset details unavailable"
          message="Classic balance details are not applied to this account type."
        />
      );
    case 'missing':
      return (
        <StateView
          kind="empty"
          title="Asset no longer present"
          message="The latest balance snapshot no longer contains this asset."
          actionLabel="Refresh"
          onAction={onRefresh}
        />
      );
    case 'ready':
      return (
        <View style={styles.ready}>
          <View style={styles.hero}>
            <View style={styles.assetIcon}>
              <Text style={styles.assetIconText}>{asset.code.slice(0, 1)}</Text>
            </View>
            <Text style={styles.assetCode}>{asset.code}</Text>
            <Text selectable style={styles.balance}>{state.line.balance}</Text>
            <Text style={styles.balanceLabel}>Current network balance</Text>
          </View>
          <View style={styles.rows}>
            <InfoRow label="Type" value={asset.kind === 'native' ? 'Stellar native asset' : 'Issued asset'} styles={styles} />
            {asset.kind === 'credit' ? <InfoRow label="Issuer" value={asset.issuer} styles={styles} mono /> : null}
            <InfoRow label="Account" value={account.address} styles={styles} mono />
            <InfoRow label="Network" value={account.networkId} styles={styles} />
          </View>
          <Text style={styles.note}>
            Balance is reloaded from the current network authority. Asset metadata and Stellar TOML remain a separate
            capability and are not fabricated on this screen.
          </Text>
          <View style={styles.action}>
            <Button label="Refresh balance" onPress={onRefresh} variant="secondary" />
          </View>
        </View>
      );
  }
}

function InfoRow({
  label,
  value,
  mono = false,
  styles,
}: Readonly<{label: string; value: string; mono?: boolean; styles: Styles}>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={mono ? 2 : 1} selectable style={[styles.rowValue, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}
