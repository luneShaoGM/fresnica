import React, { useCallback, useEffect, useRef, useState, type ComponentType, type RefAttributes } from 'react';
import { Pressable, Text, View } from 'react-native';

import type {
  DappBrowserNavigation,
  DappMessageReplyTarget,
  DappBrowserSurfaceProps,
  DappBrowserSurfaceHandle,
} from '../../../../capabilities/dapp-interaction/browserTransport';
import {
  normalizeUntrustedDappUrl,
  readPublicDappNavigation,
} from '../../../../capabilities/dapp-interaction/externalDappUrl';
import type { DappTransactionIntent } from '../../../../capabilities/dapp-interaction/dappTransactionIntent';
import type { DappMessageSigner } from '../../../../capabilities/dapp-interaction/dappMessageSigner';
import type { DappTransactionSigner } from '../../../../capabilities/dapp-interaction/dappTransactionSigner';
import {
  createFreighterSession,
  type BridgeDecision,
  type BridgeResponse,
  type DappNotificationResponse,
  type DappPublicSelection,
} from '../../../../capabilities/dapp-interaction/freighterSession';
import type {
  DappGrantScope,
  DappPermissionStore,
} from '../../../../capabilities/dapp-interaction/dappPermissionStore';
import { useLocalization } from '../../../../locale';
import { Screen } from '../../../../ui/components';
import { NativeButton } from '../../../../ui/components/NativeButton';
import { useThemedStyles } from '../../../../ui/theme';

import { DappConnectSheet } from './DappConnectSheet';
import { DappSignSheet } from './DappSignSheet';
import { createStyles } from './styles';

type Props = Readonly<{
  url: string;
  active: boolean;
  onClose: () => void;
  onVisit?: (url: string) => void;
  notificationNow?: () => number;
  showNotification?: (origin: string, title: string, body: string, expiresAt: number) => boolean;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  createNonce: () => string;
  signTransaction: DappTransactionSigner;
  signMessage?: DappMessageSigner;
  permissions: DappPermissionStore;
  // One-use proof consumed by App composition; not a route param or grant.
  trustedCatalogOrigin?: string;
  BrowserSurface: ComponentType<DappBrowserSurfaceProps & RefAttributes<DappBrowserSurfaceHandle>>;
}>;

type PendingSignature = Readonly<{
  transactionXdrBase64: string;
  origin: string;
  intent: DappTransactionIntent;
  documentEpoch: number;
  passphraseRequired: boolean;
}>;

type PendingMessage = Extract<BridgeDecision, { kind: 'sign-message' }> & {
  generation: number;
  epoch: number;
  target: DappMessageReplyTarget;
};

export function DappBrowserScreen({
  url,
  active,
  onClose,
  onVisit,
  showNotification,
  notificationNow,
  currentSelection,
  subscribeSelection,
  createNonce,
  signTransaction,
  signMessage,
  permissions,
  trustedCatalogOrigin,
  BrowserSurface,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const live = useRef(active);
  live.current = active;
  const surface = useRef<DappBrowserSurfaceHandle>(null);
  const initial = useRef<
    | {
        url: string;
        origin: string;
        token: string;
        selection: DappPublicSelection;
        session: ReturnType<typeof createFreighterSession>;
      }
    | undefined
  >(undefined);
  const [stale, setStale] = useState(false);
  const [pendingOrigin, setPendingOrigin] = useState<string>();
  const [page, setPage] = useState({ origin: '', canGoBack: false, canGoForward: false });
  type NotificationRequest = Extract<BridgeDecision, { kind: 'notification' }> & {
    origin: string;
    epoch: number;
  };
  const notificationRequest = useRef<NotificationRequest | undefined>(undefined);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pendingNotification, setPendingNotification] = useState<NotificationRequest>();
  const clearNotification = () => {
    clearTimeout(notificationTimer.current);
    notificationTimer.current = undefined;
    notificationRequest.current = undefined;
    setPendingNotification(undefined);
  };
  const [pendingSign, setPendingSign] = useState<PendingSignature>();
  const [pendingMessage, setPendingMessage] = useState<PendingMessage>();
  const [messageExpired, setMessageExpired] = useState(false);
  const [signingNow, setSigningNow] = useState(false);
  const messageReplyTarget = useRef<DappMessageReplyTarget | undefined>(undefined);
  const documentEpoch = useRef(0);
  const documentOrigin = useRef<string | undefined>(undefined);
  const signGeneration = useRef(0);
  const signing = useRef(false);
  const curatedDocumentActive = useRef(true);
  const documentStarts = useRef(0);
  const [signError, setSignError] = useState(false);
  const [permissionStorageError, setPermissionStorageError] = useState(false);
  const currentSession = () => live.current && !stale && current?.session.isLive() === true;

  if (!initial.current) {
    try {
      const target = normalizeUntrustedDappUrl(url);
      const selection = currentSelection();
      if (selection !== undefined) {
        const token = createNonce();
        const trustedInitialOrigin = trustedCatalogOrigin === target.origin;
        documentOrigin.current = target.origin;
        const hasSavedGrant = () => {
          const origin = documentOrigin.current;
          return (
            origin !== undefined &&
            permissions.has({
              origin,
              accountId: selection.accountId,
              networkId: selection.networkId,
            })
          );
        };
        initial.current = Object.freeze({
          url: target.url,
          origin: target.origin,
          token,
          selection: Object.freeze({ ...selection }),
          session: createFreighterSession({
            origin: target.origin,
            token,
            initial: selection,
            current: () => (live.current ? currentSelection() : undefined),
            persistedAllowed: () =>
              (trustedInitialOrigin && curatedDocumentActive.current && documentOrigin.current === target.origin) ||
              hasSavedGrant(),
            persistedNotificationAllowed: hasSavedGrant,
            notificationNow,
          }),
        });
      }
    } catch {
      // Bad route/entropy/account fails closed without initializing WebView.
    }
  }
  const current = initial.current;

  useEffect(() => {
    if (!current) return;
    const unsubscribe = subscribeSelection(() => {
      // The owner publishes monotonic revisions. Even A->B->A revokes the
      // original dApp connection and unmounts the WebView on first change.
      current.session.revoke();
      setStale(true);
    });
    return () => {
      unsubscribe();
      clearTimeout(notificationTimer.current);
      notificationRequest.current = undefined;
      current.session.revoke();
    };
  }, [current, subscribeSelection]);

  useEffect(() => {
    if (!current) return;
    return permissions.subscribe(event => {
      if (
        event.kind === 'closed' ||
        (event.kind === 'account-revoked' && event.accountId === current.selection.accountId) ||
        (event.kind === 'revoked' &&
          event.scope.origin === documentOrigin.current &&
          event.scope.accountId === current.selection.accountId &&
          event.scope.networkId === current.selection.networkId)
      ) {
        current.session.revoke();
        signGeneration.current += 1;
        setPendingOrigin(undefined);
        setPendingSign(undefined);
        setPendingMessage(undefined);
        setStale(true);
      }
    });
  }, [current, permissions]);

  useEffect(() => {
    if (!active && current) {
      current.session.revoke();
      setStale(true);
    }
  }, [active, current]);

  const reply = (message: BridgeResponse | DappNotificationResponse, target?: DappMessageReplyTarget) => {
    if (active && !stale) {
      if (target) surface.current?.reply(message, target);
      else surface.current?.reply(message);
    }
  };

  const expireMessage = useCallback(
    (request: Pick<PendingMessage, 'generation' | 'target'>) => {
      if (
        request.generation !== signGeneration.current ||
        messageReplyTarget.current?.replyId !== request.target.replyId
      )
        return;
      signGeneration.current += 1;
      messageReplyTarget.current = undefined;
      setPendingMessage(undefined);
      setSignError(false);
      setMessageExpired(true);
      const expired = current?.session.finishSign({ status: 'failed', error: 'request-expired' });
      if (expired && live.current) surface.current?.reply(expired, request.target);
    },
    [current],
  );

  const handleReplyExpired = (replyId: string, origin: string) => {
    const target = messageReplyTarget.current;
    if (!currentSession() || !target || target.replyId !== replyId || documentOrigin.current !== origin) return;
    // The request and expiry may arrive before React commits pendingMessage.
    // These refs bind the native event to the current request synchronously.
    expireMessage({ generation: signGeneration.current, target });
  };

  useEffect(() => {
    if (!pendingMessage || pendingMessage.target.expiresAt === undefined) return;
    const request = pendingMessage;
    const expiresAt = pendingMessage.target.expiresAt;
    // Native expiry also retires this generation if wall time moves back before timer setup.
    const timer = setTimeout(() => expireMessage(request), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [pendingMessage, expireMessage]);

  const handleMessage = (raw: string, messageUrl: string, replyId?: string, replyExpiresAt?: number) => {
    if (!current || !active || stale) return;
    const decision = current.session.receive(raw, messageUrl);
    const target = replyId
      ? { replyId, ...(replyExpiresAt === undefined ? {} : { expiresAt: replyExpiresAt }) }
      : undefined;
    if (decision.kind === 'notification') {
      const origin = documentOrigin.current;
      const remainingMs = decision.expiresAt - (notificationNow?.() ?? Number.NaN);
      if (!showNotification || !origin || notificationRequest.current || !(remainingMs > 0)) {
        reply({ source: 'FRESNICA_DAPP_MSG_RESPONSE', messagedId: decision.messageId, shown: false });
      } else {
        const request = {
          ...decision,
          origin,
          epoch: documentEpoch.current,
        };
        notificationRequest.current = request;
        setPendingNotification(request);
        notificationTimer.current = setTimeout(() => answerNotification(request, false), remainingMs);
      }
    }
    if (decision.kind === 'respond') reply(decision.response, target);
    if (decision.kind === 'permission') setPendingOrigin(decision.origin);
    if (decision.kind === 'sign-message') {
      if (!target || !signMessage) {
        const failed = current.session.finishSign({ status: 'failed', error: 'unsupported-signer' });
        if (failed && target) reply(failed, target);
        return;
      }
      signGeneration.current += 1;
      setSignError(false);
      setMessageExpired(false);
      messageReplyTarget.current = target;
      const request = { ...decision, generation: signGeneration.current, epoch: documentEpoch.current, target };
      if (target.expiresAt !== undefined && Date.now() >= target.expiresAt) expireMessage(request);
      else setPendingMessage(request);
    }
    if (decision.kind === 'sign-transaction') {
      const generation = signGeneration.current + 1;
      signGeneration.current = generation;
      inspectSignature(decision, generation).catch(() => undefined);
    }
  };

  const answerNotification = (request: NotificationRequest, approved: boolean) => {
    if (notificationRequest.current !== request) return;
    clearNotification();
    const stillCurrent = () =>
      currentSession() && documentEpoch.current === request.epoch && documentOrigin.current === request.origin;
    if (!stillCurrent()) return;
    let shown = false;
    if (approved && current?.session.notificationAllowed() && (notificationNow?.() ?? Number.NaN) < request.expiresAt) {
      try {
        shown = showNotification?.(request.origin, request.title, request.body, request.expiresAt) === true;
      } catch {
        // An unavailable native transport reports failure to the requesting document.
      }
    }
    if (stillCurrent()) reply({ source: 'FRESNICA_DAPP_MSG_RESPONSE', messagedId: request.messageId, shown });
  };

  const inspectSignature = async (
    decision: Extract<BridgeDecision, { kind: 'sign-transaction' }>,
    generation: number,
  ) => {
    if (!current) return;
    let inspected: Awaited<ReturnType<DappTransactionSigner>>;
    try {
      inspected = await signTransaction({
        phase: 'inspect',
        accountId: current.selection.accountId,
        accountAddress: decision.accountAddress,
        networkId: current.selection.networkId,
        networkPassphrase: decision.networkPassphrase,
        transactionXdrBase64: decision.transactionXdrBase64,
      });
    } catch {
      inspected = { status: 'invalid' };
    }
    if (!current || generation !== signGeneration.current || !currentSession()) return;
    if (inspected.status !== 'ready') {
      const failed = current.session.finishSign({
        status: 'failed',
        error: inspected.status === 'unsupported-signer' ? 'unsupported-signer' : 'invalid-transaction',
      });
      if (failed) reply(failed);
      return;
    }
    setPendingSign({
      transactionXdrBase64: decision.transactionXdrBase64,
      origin: decision.origin,
      intent: inspected.intent,
      documentEpoch: documentEpoch.current,
      passphraseRequired: true,
    });
  };

  const rejectSignature = () => {
    signGeneration.current += 1;
    setPendingSign(undefined);
    setPendingMessage(undefined);
    setSignError(false);
    setMessageExpired(false);
    if (!current || !active || stale) return;
    const target = current.session.hasPendingMessage() ? messageReplyTarget.current : undefined;
    messageReplyTarget.current = undefined;
    const declined = current.session.finishSign({ status: 'declined' });
    if (declined) reply(declined, target);
  };

  const confirmSignature = async (appPassphrase: string) => {
    if (!current || !pendingSign || signing.current || !currentSession()) return;
    const request = pendingSign;
    if (request.documentEpoch !== documentEpoch.current) return;
    const generation = signGeneration.current;
    const isCurrent = () =>
      currentSession() && generation === signGeneration.current && request.documentEpoch === documentEpoch.current;
    signing.current = true;
    setSigningNow(true);
    setSignError(false);
    try {
      if (!isCurrent()) return;
      const signed = await signTransaction({
        phase: 'sign',
        accountId: current.selection.accountId,
        accountAddress: current.selection.address,
        networkId: current.selection.networkId,
        networkPassphrase: current.selection.networkPassphrase,
        transactionXdrBase64: request.transactionXdrBase64,
        reviewedHash: request.intent.hash,
        isCurrent,
        appPassphrase,
      });
      if (!isCurrent()) return;
      if (signed.status === 'passphrase-required') {
        setPendingSign({ ...request, passphraseRequired: true });
        return;
      }
      const completed = current.session.finishSign(
        signed.status === 'signed'
          ? { status: 'signed', signedTransaction: signed.signedTransaction, signerAddress: signed.signerAddress }
          : {
              status: 'failed',
              error: signed.status === 'unsupported-signer' ? 'unsupported-signer' : 'invalid-transaction',
            },
      );
      setPendingSign(undefined);
      if (completed) reply(completed);
    } catch (error) {
      if (!isCurrent()) return;
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'user-cancel') {
        const declined = current.session.finishSign({ status: 'declined' });
        setPendingSign(undefined);
        if (declined) reply(declined);
      } else {
        setSignError(true);
      }
    } finally {
      signing.current = false;
      setSigningNow(false);
    }
  };

  const confirmMessage = async (request: PendingMessage, appPassphrase: string) => {
    if (request.target.expiresAt !== undefined && Date.now() >= request.target.expiresAt) {
      expireMessage(request);
      return;
    }
    if (!current || !signMessage || !appPassphrase || signing.current) return;
    const isCurrent = () =>
      currentSession() &&
      request.generation === signGeneration.current &&
      request.epoch === documentEpoch.current &&
      (request.target.expiresAt === undefined || Date.now() < request.target.expiresAt) &&
      current.session.canSignMessage();
    if (!isCurrent()) return;
    signing.current = true;
    setSigningNow(true);
    setSignError(false);
    try {
      const signature = await signMessage({
        accountId: current.selection.accountId,
        accountAddress: current.selection.address,
        networkId: current.selection.networkId,
        message: request.message,
        encoding: request.encoding,
        appPassphrase,
        isCurrent,
      });
      if (!isCurrent()) return;
      const completed = current.session.finishSign(
        signature
          ? { status: 'message-signed', signedBlob: signature, signerAddress: current.selection.address }
          : { status: 'failed', error: 'unsupported-signer' },
      );
      setPendingMessage(undefined);
      messageReplyTarget.current = undefined;
      if (completed) reply(completed, request.target);
    } catch (error) {
      if (!isCurrent()) return;
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'user-cancel') {
        rejectSignature();
      } else {
        setSignError(true);
      }
    } finally {
      signing.current = false;
      setSigningNow(false);
    }
  };

  const navigateBrowser = (action: 'goBack' | 'goForward' | 'reload') => {
    clearNotification();
    if (current?.session.hasPendingMessage()) rejectSignature();
    surface.current?.[action]();
  };

  const choosePermission = (decision: 'once' | 'always' | 'reject') => {
    const grantedOrigin = pendingOrigin;
    setPendingOrigin(undefined);
    if (!current || !currentSession()) return;
    const result = current.session.resolvePermission(decision !== 'reject');
    if (result?.kind !== 'respond') return;
    if (decision === 'always' && grantedOrigin && !result.response.error && currentSession()) {
      const scope: DappGrantScope = {
        origin: grantedOrigin,
        accountId: current.selection.accountId,
        networkId: current.selection.networkId,
      };
      try {
        // Only persist after the current session resolves its consent.
        permissions.grant(scope);
      } catch {
        reply({
          source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
          messagedId: result.response.messagedId,
          error: 'permission-storage-failed',
        });
        current.session.revoke();
        setPermissionStorageError(true);
        setStale(true);
        return;
      }
    }
    reply(result.response);
  };

  const shouldLoad = (candidate: string) => {
    if (!current || !active || stale) return false;
    if (candidate === 'about:blank') return true;
    return readPublicDappNavigation(candidate) !== undefined;
  };

  const retireInvalidNavigation = () => {
    // A navigation bypassing the normal URL gate must synchronously revoke
    // the bridge. Do not keep showing the previous, trusted address.
    current?.session.revoke();
    clearNotification();
    messageReplyTarget.current = undefined;
    documentEpoch.current += 1;
    signGeneration.current += 1;
    setPendingOrigin(undefined);
    setPendingSign(undefined);
    setPendingMessage(undefined);
    setSignError(false);
    setStale(true);
  };

  const onDocumentStart = (nextUrl: string) => {
    if (!current || !currentSession()) return;
    if (nextUrl === 'about:blank') {
      if (current.session.hasPendingMessage()) rejectSignature();
      return;
    }
    const target = readPublicDappNavigation(nextUrl);
    if (!target) {
      retireInvalidNavigation();
      return;
    }
    // A curated launch proves only its first exact main document. A reload,
    // a different path or a redirect drops implicit access forever, including
    // after navigating to another origin and back. SPA history is not a new
    // document and does not retire the first-document proof.
    if (documentStarts.current > 0 || target.url !== current.url) curatedDocumentActive.current = false;
    documentStarts.current += 1;
    clearNotification();
    messageReplyTarget.current = undefined;
    documentEpoch.current += 1;
    documentOrigin.current = target.origin;
    current.session.activateDocument(target.origin);
    if (currentSession()) onVisit?.(target.origin);
    signGeneration.current += 1;
    setPendingOrigin(undefined);
    setPendingSign(undefined);
    setPendingMessage(undefined);
    setSignError(false);
    setMessageExpired(false);
  };

  const onNavigation = (next: DappBrowserNavigation) => {
    if (!current || !active || stale || next.url === 'about:blank') return;
    const target = readPublicDappNavigation(next.url);
    if (!target) {
      retireInvalidNavigation();
      return;
    }
    // Some WebView platforms can report a completed cross-origin navigation
    // before document-start. Even that path must retire curated read access.
    if (target.origin !== documentOrigin.current) clearNotification();
    if (target.origin !== documentOrigin.current && current.session.hasPendingMessage()) rejectSignature();
    if (target.origin !== current.origin) curatedDocumentActive.current = false;
    setPage({ origin: target.origin, canGoBack: next.canGoBack, canGoForward: next.canGoForward });
  };

  const close = () => {
    current?.session.revoke();
    clearNotification();
    onClose();
  };

  if (!current || stale || !active) {
    return (
      <Screen>
        <NativeButton label={t('common.back')} onPress={close} variant="quiet" />
        <Text style={styles.error}>
          {t(permissionStorageError ? 'dapps.permission.storageFailed' : 'dapps.browser.unavailable')}
        </Text>
      </Screen>
    );
  }

  const shownOrigin = page.origin || current.origin;

  return (
    <Screen contentInset="none" scrollable={false}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.tools}>
            <ToolButton
              disabled={!page.canGoBack}
              glyph="‹"
              label={t('dapps.browser.back')}
              onPress={() => navigateBrowser('goBack')}
              styles={styles}
            />
            <ToolButton
              disabled={!page.canGoForward}
              glyph="›"
              label={t('dapps.browser.forward')}
              onPress={() => navigateBrowser('goForward')}
              styles={styles}
            />
            <ToolButton
              glyph="↻"
              label={t('dapps.browser.reload')}
              onPress={() => navigateBrowser('reload')}
              styles={styles}
            />
          </View>
          <Text selectable numberOfLines={1} style={styles.origin}>
            {shownOrigin}
          </Text>
          <ToolButton glyph="×" label={t('dapps.browser.close')} onPress={close} styles={styles} />
        </View>
        {messageExpired ? <Text style={styles.error}>{t('dapps.signMessage.expired')}</Text> : null}
        {pendingNotification ? (
          <View style={styles.permission}>
            <Text style={styles.heading}>{t('dapps.notification.title')}</Text>
            <Text selectable style={styles.notice}>
              {pendingNotification.origin}
            </Text>
            <NativeButton
              label={t('dapps.notification.allow')}
              onPress={() => answerNotification(pendingNotification, true)}
            />
            <NativeButton
              label={t('common.cancel')}
              onPress={() => answerNotification(pendingNotification, false)}
              variant="quiet"
            />
          </View>
        ) : null}
        <View style={styles.browser}>
          <BrowserSurface
            ref={surface}
            url={current.url}
            nonce={current.token}
            onMessage={handleMessage}
            onReplyExpired={handleReplyExpired}
            onNavigation={onNavigation}
            onDocumentStart={onDocumentStart}
            onUnavailable={retireInvalidNavigation}
            shouldLoad={shouldLoad}
          />
        </View>
        {pendingOrigin ? (
          <DappConnectSheet
            address={current.selection.address}
            networkLabel={networkLabel(current.selection.networkId)}
            onAllowAlways={() => choosePermission('always')}
            onAllowOnce={() => choosePermission('once')}
            onReject={() => choosePermission('reject')}
            origin={pendingOrigin}
            visible
          />
        ) : null}
        {pendingMessage ? (
          <DappSignSheet
            key={pendingMessage.generation}
            message={pendingMessage.message}
            expiresAt={pendingMessage.target.expiresAt}
            onExpired={() => expireMessage(pendingMessage)}
            busy={signingNow}
            address={current.selection.address}
            network={networkLabel(current.selection.networkId)}
            origin={pendingMessage.origin}
            onConfirm={passphrase => {
              confirmMessage(pendingMessage, passphrase);
            }}
            failed={signError}
            onReject={() => {
              if (pendingMessage.generation === signGeneration.current) rejectSignature();
            }}
            passphraseRequired
            visible
          />
        ) : null}
        {pendingSign ? (
          <DappSignSheet
            intent={pendingSign.intent}
            busy={signingNow}
            onConfirm={passphrase => {
              confirmSignature(passphrase);
            }}
            failed={signError}
            onReject={rejectSignature}
            origin={pendingSign.origin}
            passphraseRequired={pendingSign.passphraseRequired}
            visible
          />
        ) : null}
      </View>
    </Screen>
  );
}

function ToolButton({
  disabled,
  glyph,
  label,
  onPress,
  styles,
}: Readonly<{
  disabled?: boolean;
  glyph: string;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, disabled ? styles.toolDisabled : undefined]}
    >
      <Text allowFontScaling={false} style={styles.toolGlyph}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function networkLabel(networkId: string): string {
  if (networkId === 'stellar-testnet') return 'Testnet';
  if (networkId === 'stellar-mainnet') return 'Mainnet';
  return networkId;
}
