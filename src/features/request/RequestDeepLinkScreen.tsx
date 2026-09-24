import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { RequestPaymentIntent } from '../../capabilities/request/requestUri';
import { useLocalization } from '../../locale';
import { Screen } from '../../ui/components';
import { useThemedStyles } from '../../ui/theme';
import { maskRequestIssuer } from './RequestFormScreen';
import { createRequestIngressStyles } from './ingressStyles';

export type RequestDeepLinkViewState =
  | Readonly<{ kind: 'ready'; intent: RequestPaymentIntent; accountId: string }>
  | Readonly<{
      kind: 'blocked';
      reason: 'invalid' | 'unsupported' | 'network-mismatch' | 'no-account' | 'account-ineligible';
    }>;

type Props = Readonly<{
  state: RequestDeepLinkViewState;
  onClose: () => void;
}>;

export function RequestDeepLinkScreen({ state, onClose }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel={t('request.deepLink.close')} onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>{t('request.deepLink.close')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('request.deepLink.title')}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.kind === 'ready' ? <ReadyCard intent={state.intent} /> : <BlockedCard reason={state.reason} />}
      </ScrollView>
    </Screen>
  );
}

function ReadyCard({ intent }: Readonly<{ intent: RequestPaymentIntent }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);
  const asset =
    intent.asset.kind === 'native' ? 'XLM' : `${intent.asset.code} · ${maskRequestIssuer(intent.asset.issuer)}`;

  return (
    <View style={styles.resultCard}>
      <Text accessibilityLiveRegion="polite" style={styles.resultTitle}>
        {t('request.deepLink.ready.title')}
      </Text>
      <Text style={styles.resultBody}>{t('request.deepLink.ready.body')}</Text>
      <Detail label={t('request.ingress.accepted.destination')} value={intent.destination} />
      <Detail label={t('request.ingress.accepted.asset')} value={asset} />
      <Detail
        label={t('request.ingress.accepted.amount')}
        value={intent.amount ?? t('request.ingress.accepted.openAmount')}
      />
    </View>
  );
}

function BlockedCard({
  reason,
}: Readonly<{ reason: Extract<RequestDeepLinkViewState, { kind: 'blocked' }>['reason'] }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);
  return (
    <View style={styles.errorCard}>
      <Text accessibilityLiveRegion="assertive" style={styles.errorTitle}>
        {t('request.deepLink.blocked.title')}
      </Text>
      <Text style={styles.errorBody}>{t(`request.deepLink.blocked.${reason}`)}</Text>
    </View>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(createRequestIngressStyles);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}
