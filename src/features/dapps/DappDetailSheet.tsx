import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import type { DappCatalogEntry } from '@capabilities/dapp-catalog/catalog';
import type { PublicDappDetailResult, DappPublicMediaPort } from '@capabilities/dapp-catalog/dappPublicMedia';
import { BottomSheet } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useLocalization } from '../../locale';
import { useDappIconState } from './DappCatalogIcon';

import type { createStyles } from './screens/DAppsScreen/styles';

type Styles = ReturnType<typeof createStyles>;
type DetailState =
  | Readonly<{ kind: 'loading'; appId?: string; owner?: DappPublicMediaPort }>
  | Readonly<{ kind: 'unavailable'; appId: string; owner: DappPublicMediaPort }>
  | Readonly<{ kind: 'ready'; appId: string; owner: DappPublicMediaPort; value: PublicDappDetailResult }>;

export function DappDetailSheet({
  entry,
  media,
  styles,
  active,
  online,
  onClose,
  onOpen,
  inAppAvailable,
  implicitReadOnly = false,
}: Readonly<{
  entry?: DappCatalogEntry;
  media?: DappPublicMediaPort;
  styles: Styles;
  active: boolean;
  online: boolean;
  onClose: () => void;
  onOpen?: () => void;
  inAppAvailable?: boolean;
  implicitReadOnly?: boolean;
}>) {
  const { t } = useLocalization();
  const [state, setState] = useState<DetailState>({ kind: 'loading' });
  const [retry, setRetry] = useState<{ appId: string; count: number }>({ appId: '', count: 0 });
  const iconState = useDappIconState(media);

  useEffect(() => {
    if (!entry || !media) return;
    const cached = media.readCachedDetail(entry.id);
    setState(
      cached
        ? { kind: 'ready', appId: entry.id, owner: media, value: cached }
        : { kind: online && active ? 'loading' : 'unavailable', appId: entry.id, owner: media },
    );
    if (!active || !online) return;
    let current = true;
    const controller = new AbortController();
    media
      .loadDetail(entry.id, controller.signal, retry.appId === entry.id && retry.count > 0)
      .then(result => {
        if (current && !controller.signal.aborted)
          setState({ kind: 'ready', appId: entry.id, owner: media, value: result });
      })
      .catch(() => {
        if (current && !controller.signal.aborted) {
          setState(previous =>
            previous.kind === 'ready' && previous.appId === entry.id && previous.owner === media
              ? previous
              : { kind: 'unavailable', appId: entry.id, owner: media },
          );
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [entry, media, active, online, retry]);

  // A closed/changed sheet must never momentarily show another dApp's or
  // another network session's details while a fresh effect is pending.
  const currentState = entry && state.appId === entry.id && state.owner === media ? state : undefined;
  const iconUrl = currentState?.kind === 'ready' ? currentState.value.detail.iconUrl : undefined;
  useEffect(() => {
    if (!entry || !media?.available || !active || !online || !iconState.enabled) return;
    const controller = new AbortController();
    const selected = iconUrl ? { ...entry, iconUrl } : entry;
    media.loadIcon(selected, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [entry, media, active, online, iconState.enabled, iconUrl]);

  const detail = currentState?.kind === 'ready' ? currentState.value.detail : undefined;
  return (
    <BottomSheet closeLabel={t('dapps.details.close')} onClose={onClose} visible={!!entry}>
      <View style={styles.urlSheet}>
        <View style={styles.urlSheetHeader}>
          <Text style={styles.sectionTitle}>{entry?.title ?? t('dapps.details.title')}</Text>
          <NativeButton label={t('dapps.details.close')} onPress={onClose} variant="quiet" />
        </View>
        <Text style={styles.websiteDetail}>{t('dapps.details.untrusted')}</Text>
        {inAppAvailable && implicitReadOnly ? (
          <Text style={styles.websiteDetail}>{t('dapps.details.autoConnectionNotice')}</Text>
        ) : null}
        {!media ? (
          <Text style={styles.websiteDetail}>{t('dapps.details.unavailable')}</Text>
        ) : !currentState || currentState.kind === 'loading' ? (
          <ActivityIndicator accessibilityLabel={t('dapps.details.loading')} />
        ) : detail ? (
          <>
            {currentState?.kind === 'ready' && currentState.value.stale ? (
              <Text style={styles.previewNotice}>{t('dapps.details.cached')}</Text>
            ) : null}
            <Text style={styles.websiteDetail}>{detail.longDescription}</Text>
            <Text style={styles.websiteDetail}>
              {t('dapps.details.developer')}: {detail.developerName}
            </Text>
            <Text selectable style={styles.websiteOrigin}>
              {detail.websiteUrl}
            </Text>
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" style={styles.websiteDetail}>
            {t('dapps.details.unavailable')}
          </Text>
        )}
        {entry && onOpen && active ? (
          <NativeButton
            label={t(inAppAvailable ? 'dapps.website.openInApp' : 'dapps.website.preview')}
            onPress={onOpen}
            variant="primary"
          />
        ) : null}
        {active && online && currentState?.kind !== 'loading' ? (
          <NativeButton
            label={t('dapps.details.retry')}
            variant="secondary"
            onPress={() =>
              entry && setRetry(value => ({ appId: entry.id, count: value.appId === entry.id ? value.count + 1 : 1 }))
            }
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}
