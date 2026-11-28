import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import type { DappCatalogEntry } from '@capabilities/dapp-catalog/catalog';
import type { PublicDappDetailResult, DappPublicMediaPort } from '@capabilities/dapp-catalog/dappPublicMedia';
import { BottomSheet } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useLocalization } from '../../locale';
import { DappCatalogIcon, useDappIconState } from './DappCatalogIcon';

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
  onShare,
  networkLabel,
  siteOrigin,
}: Readonly<{
  entry?: DappCatalogEntry;
  media?: DappPublicMediaPort;
  styles: Styles;
  active: boolean;
  online: boolean;
  onClose: () => void;
  onShare?: () => void;
  networkLabel: string;
  siteOrigin: string;
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
    <BottomSheet closeLabel={t('common.close')} onClose={onClose} visible={!!entry}>
      <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.urlSheet}>
        <View style={styles.urlSheetHeader}>
          {entry ? <DappCatalogIcon entry={entry} media={media} styles={styles} /> : null}
          <Text style={[styles.sectionTitle, styles.sheetHeaderTitle]}>{entry?.title ?? t('dapps.details.title')}</Text>
          <NativeButton label={t('common.close')} onPress={onClose} variant="quiet" />
        </View>
        <Text style={styles.websiteDetail}>{t('dapps.details.untrusted')}</Text>
        <Text selectable style={styles.websiteOrigin}>
          {siteOrigin}
        </Text>
        <Text style={styles.websiteDetail}>
          {t('dapps.permission.network')}: {networkLabel}
        </Text>
        {!detail && entry ? <Text style={styles.websiteDetail}>{entry.description}</Text> : null}
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
            {(
              [
                ['dapps.details.website', detail.developerWebsite],
                ['dapps.details.terms', detail.termsUrl],
                ['dapps.details.privacy', detail.privacyUrl],
                ['dapps.details.support', detail.supportUrl],
              ] as const
            ).map(([label, link]) =>
              link ? (
                <View key={label}>
                  <Text style={styles.sectionTitle}>{t(label)}</Text>
                  <Text selectable style={styles.websiteOrigin}>
                    {link}
                  </Text>
                </View>
              ) : null,
            )}
            {detail.supportedNetworks?.length ? (
              <Text style={styles.websiteDetail}>
                {t('dapps.details.networks')}:{' '}
                {detail.supportedNetworks.map(id => t(`networkManage.name.${id}`)).join(' / ')}
              </Text>
            ) : null}
            {entry && detail.websiteUrl !== entry.websiteUrl ? (
              <Text style={styles.previewNotice}>{t('dapps.details.launchUrlChanged')}</Text>
            ) : null}
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" style={styles.websiteDetail}>
            {t('dapps.details.unavailable')}
          </Text>
        )}
        {onShare ? <NativeButton label={t('dapps.browser.shareOrigin')} onPress={onShare} variant="primary" /> : null}
        {active && online && currentState?.kind !== 'loading' ? (
          <NativeButton
            label={t('dapps.details.retry')}
            variant="secondary"
            onPress={() =>
              entry && setRetry(value => ({ appId: entry.id, count: value.appId === entry.id ? value.count + 1 : 1 }))
            }
          />
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}
