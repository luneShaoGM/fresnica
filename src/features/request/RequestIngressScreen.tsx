import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { RequestCameraPermissionState } from '../../capabilities/request/RequestIngressPort';
import type { RequestScannerViewProps } from '../../capabilities/request/RequestScannerViewPort';
import type { RequestPaymentIntent, RequestParseResult } from '../../capabilities/request/requestUri';
import { useLocalization } from '../../locale';
import { Screen } from '../../ui/components';
import { useThemedStyles } from '../../ui/theme';
import type { RequestIngressCarrier, RequestIngressResult } from './requestIngressFlow';
import { maskRequestIssuer } from './RequestFormScreen';
import { createRequestIngressStyles } from './ingressStyles';

export type RequestIngressPermissionViewState = RequestCameraPermissionState | 'checking' | 'error';
export type RequestIngressPlatformError = 'clipboard' | 'camera' | 'settings';

export type RequestScannerViewComponent = React.ComponentType<RequestScannerViewProps>;

type Props = Readonly<{
  carrier: RequestIngressCarrier;
  result?: RequestIngressResult;
  permissionState?: RequestIngressPermissionViewState;
  platformError?: RequestIngressPlatformError;
  scannerActive: boolean;
  torchEnabled: boolean;
  ScannerView: RequestScannerViewComponent;
  onCode: (value: string) => void;
  onScannerError: () => void;
  onToggleTorch: () => void;
  onRetry: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}>;

export function RequestIngressScreen(props: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);
  const title = props.carrier === 'paste' ? t('request.ingress.title.paste') : t('request.ingress.title.scan');

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <Pressable accessibilityLabel={t('request.ingress.close')} onPress={props.onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>{t('request.ingress.close')}</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {props.result ? (
          <IngressResultCard carrier={props.carrier} parsed={props.result.result} onRetry={props.onRetry} />
        ) : props.platformError ? (
          <IngressPlatformErrorCard
            error={props.platformError}
            onRetry={props.onRetry}
            onOpenSettings={props.onOpenSettings}
          />
        ) : props.carrier === 'scan' ? (
          <ScannerState {...props} />
        ) : (
          <View style={styles.center}>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {t('request.ingress.paste.loading')}
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ScannerState(props: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);
  const permission = props.permissionState ?? 'checking';

  if (permission === 'granted') {
    const ScannerView = props.ScannerView;
    return (
      <>
        <Text style={styles.purpose}>{t('request.ingress.scan.purpose')}</Text>
        <View accessibilityLabel={t('request.ingress.scan.camera')} style={styles.scannerFrame}>
          <ScannerView
            active={props.scannerActive}
            onCode={props.onCode}
            onError={props.onScannerError}
            torchEnabled={props.torchEnabled}
          />
        </View>
        <View style={styles.scannerControls}>
          <IngressAction
            label={props.torchEnabled ? t('request.ingress.scan.torchOff') : t('request.ingress.scan.torchOn')}
            onPress={props.onToggleTorch}
          />
        </View>
      </>
    );
  }

  if (permission === 'checking') {
    return <StatusCard title={t('request.ingress.permission.checking')} body={t('request.ingress.scan.purpose')} />;
  }

  const detail = permissionMessage(permission, t);
  return (
    <View style={styles.center}>
      <View style={styles.statusCard}>
        <Text accessibilityLiveRegion="assertive" style={styles.statusTitle}>
          {detail.title}
        </Text>
        <Text style={styles.resultBody}>{detail.body}</Text>
      </View>
      <View style={styles.actions}>
        {(permission === 'denied' || permission === 'blocked' || permission === 'error') && (
          <IngressAction label={t('request.ingress.retry')} onPress={props.onRetry} />
        )}
        {permission === 'blocked' ? (
          <IngressAction label={t('request.ingress.permission.settings')} onPress={props.onOpenSettings} secondary />
        ) : null}
      </View>
    </View>
  );
}

function IngressResultCard({
  carrier,
  parsed,
  onRetry,
}: Readonly<{ carrier: RequestIngressCarrier; parsed: RequestParseResult; onRetry: () => void }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);

  if (parsed.status === 'accepted') {
    return (
      <View style={styles.resultCard}>
        <Text accessibilityLiveRegion="polite" style={styles.resultTitle}>
          {t('request.ingress.accepted.title')}
        </Text>
        <Text style={styles.resultBody}>
          {t('request.ingress.accepted.body', { carrier: t(`request.ingress.carrier.${carrier}`) })}
        </Text>
        <IntentDetails intent={parsed.intent} />
        <View style={styles.actions}>
          <IngressAction label={t('request.ingress.retry')} onPress={onRetry} />
        </View>
      </View>
    );
  }

  const message = parseFailureMessage(parsed, t);
  return (
    <View style={styles.errorCard}>
      <Text accessibilityLiveRegion="assertive" style={styles.errorTitle}>
        {message.title}
      </Text>
      <Text style={styles.errorBody}>{message.body}</Text>
      <View style={styles.actions}>
        <IngressAction label={t('request.ingress.retry')} onPress={onRetry} />
      </View>
    </View>
  );
}

function IntentDetails({ intent }: Readonly<{ intent: RequestPaymentIntent }>) {
  const { t } = useLocalization();
  const asset =
    intent.asset.kind === 'native' ? 'XLM' : `${intent.asset.code} · ${maskRequestIssuer(intent.asset.issuer)}`;

  return (
    <>
      <Detail label={t('request.ingress.accepted.destination')} value={intent.destination} />
      <Detail label={t('request.ingress.accepted.asset')} value={asset} />
      <Detail
        label={t('request.ingress.accepted.amount')}
        value={intent.amount ?? t('request.ingress.accepted.openAmount')}
      />
    </>
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

function IngressPlatformErrorCard({
  error,
  onRetry,
  onOpenSettings,
}: Readonly<{ error: RequestIngressPlatformError; onRetry: () => void; onOpenSettings: () => void }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createRequestIngressStyles);
  const title = t('request.ingress.platformError.title');
  const body = t(`request.ingress.platformError.${error}`);
  return (
    <View style={styles.errorCard}>
      <Text accessibilityLiveRegion="assertive" style={styles.errorTitle}>
        {title}
      </Text>
      <Text style={styles.errorBody}>{body}</Text>
      <View style={styles.actions}>
        <IngressAction label={t('request.ingress.retry')} onPress={onRetry} />
        {error === 'settings' ? (
          <IngressAction label={t('request.ingress.permission.settings')} onPress={onOpenSettings} secondary />
        ) : null}
      </View>
    </View>
  );
}

function StatusCard({ title, body }: Readonly<{ title: string; body: string }>) {
  const styles = useThemedStyles(createRequestIngressStyles);
  return (
    <View style={styles.center}>
      <View style={styles.statusCard}>
        <Text accessibilityLiveRegion="polite" style={styles.statusTitle}>
          {title}
        </Text>
        <Text style={styles.resultBody}>{body}</Text>
      </View>
    </View>
  );
}

function IngressAction({
  label,
  onPress,
  secondary = false,
}: Readonly<{ label: string; onPress: () => void; secondary?: boolean }>) {
  const styles = useThemedStyles(createRequestIngressStyles);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        secondary ? styles.secondaryAction : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function permissionMessage(
  permission: Exclude<RequestIngressPermissionViewState, 'granted' | 'checking'>,
  t: (key: string) => string,
): Readonly<{ title: string; body: string }> {
  switch (permission) {
    case 'denied':
      return { title: t('request.ingress.permission.denied.title'), body: t('request.ingress.permission.denied.body') };
    case 'blocked':
      return {
        title: t('request.ingress.permission.blocked.title'),
        body: t('request.ingress.permission.blocked.body'),
      };
    case 'unavailable':
      return {
        title: t('request.ingress.permission.unavailable.title'),
        body: t('request.ingress.permission.unavailable.body'),
      };
    case 'error':
      return { title: t('request.ingress.permission.error.title'), body: t('request.ingress.permission.error.body') };
  }
}

function parseFailureMessage(
  parsed: Exclude<RequestParseResult, { status: 'accepted' }>,
  t: (key: string) => string,
): Readonly<{ title: string; body: string }> {
  if (parsed.status === 'unsupported') {
    return { title: t('request.ingress.unsupported.title'), body: t('request.ingress.unsupported.body') };
  }
  if (parsed.reason === 'sensitive-input') {
    return { title: t('request.ingress.rejected.title'), body: t('request.ingress.rejected.sensitive') };
  }
  if (parsed.reason === 'network-mismatch') {
    return { title: t('request.ingress.rejected.title'), body: t('request.ingress.rejected.network') };
  }
  return { title: t('request.ingress.rejected.title'), body: t('request.ingress.rejected.invalid') };
}
