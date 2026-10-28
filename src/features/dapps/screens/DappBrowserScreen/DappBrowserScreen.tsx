import React, { useEffect, useRef, useState, type ComponentType, type RefAttributes } from 'react';
import { Pressable, Text, View } from 'react-native';

import type {
  DappBrowserNavigation,
  DappBrowserSurfaceProps,
  DappBrowserSurfaceHandle,
} from '../../../../capabilities/dapp-interaction/browserTransport';
import {
  normalizeUntrustedDappUrl,
  readPublicDappNavigation,
} from '../../../../capabilities/dapp-interaction/externalDappUrl';
import type { DappTransactionIntent } from '../../../../capabilities/dapp-interaction/dappTransactionIntent';
import type { DappTransactionSigner } from '../../../../capabilities/dapp-interaction/dappTransactionSigner';
import {
  createFreighterSession,
  type BridgeDecision,
  type BridgeResponse,
  type DappPublicSelection,
} from '../../../../capabilities/dapp-interaction/freighterSession';
import { hasDappReadGrant, rememberDappReadGrant } from '../../../../capabilities/dapp-interaction/permissionMemory';
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
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  createNonce: () => string;
  signTransaction: DappTransactionSigner;
  hasPersistentAccess?: (origin: string, accountId: string, networkId: string) => boolean;
  rememberPersistentAccess?: (origin: string, accountId: string, networkId: string) => void;
  isCatalogOrigin?: (origin: string) => boolean;
  BrowserSurface: ComponentType<DappBrowserSurfaceProps & RefAttributes<DappBrowserSurfaceHandle>>;
}>;

type PendingSignature = Readonly<{
  transactionXdrBase64: string;
  origin: string;
  intent: DappTransactionIntent;
  documentEpoch: number;
  passphraseRequired: boolean;
}>;

export function DappBrowserScreen({
  url,
  active,
  onClose,
  currentSelection,
  subscribeSelection,
  createNonce,
  signTransaction,
  hasPersistentAccess,
  rememberPersistentAccess,
  isCatalogOrigin,
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
  const [pendingSign, setPendingSign] = useState<PendingSignature>();
  const documentEpoch = useRef(0);
  const documentOrigin = useRef<string | undefined>(undefined);
  const signGeneration = useRef(0);
  const signing = useRef(false);
  const [signError, setSignError] = useState(false);
  const currentSession = () => live.current && !stale && current?.session.isLive() === true;

  if (!initial.current) {
    try {
      const target = normalizeUntrustedDappUrl(url);
      const selection = currentSelection();
      if (selection !== undefined) {
        const token = createNonce();
        documentOrigin.current = target.origin;
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
            persistedAllowed: () => {
              const origin = documentOrigin.current;
              if (origin === undefined) return false;
              return (
                hasDappReadGrant(origin, selection.accountId, selection.networkId) ||
                hasPersistentAccess?.(origin, selection.accountId, selection.networkId) === true ||
                isCatalogOrigin?.(origin) === true
              );
            },
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
      current.session.revoke();
    };
  }, [current, subscribeSelection]);

  useEffect(() => {
    if (!active && current) {
      current.session.revoke();
      setStale(true);
    }
  }, [active, current]);

  const reply = (message: BridgeResponse) => {
    if (active && !stale) surface.current?.reply(message);
  };

  const handleMessage = (raw: string, messageUrl: string) => {
    if (!current || !active || stale) return;
    const decision = current.session.receive(raw, messageUrl);
    if (decision.kind === 'respond') reply(decision.response);
    if (decision.kind === 'permission') setPendingOrigin(decision.origin);
    if (decision.kind === 'sign-transaction') {
      const generation = signGeneration.current + 1;
      signGeneration.current = generation;
      inspectSignature(decision, generation).catch(() => undefined);
    }
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
      passphraseRequired: false,
    });
  };

  const rejectSignature = () => {
    signGeneration.current += 1;
    setPendingSign(undefined);
    setSignError(false);
    if (!current || !active || stale) return;
    const declined = current.session.finishSign({ status: 'declined' });
    if (declined) reply(declined);
  };

  const confirmSignature = async (appPassphrase: string) => {
    if (!current || !pendingSign || signing.current || !currentSession()) return;
    const request = pendingSign;
    if (request.documentEpoch !== documentEpoch.current) return;
    const generation = signGeneration.current;
    const isCurrent = () =>
      currentSession() && generation === signGeneration.current && request.documentEpoch === documentEpoch.current;
    signing.current = true;
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
    }
  };

  const choosePermission = (decision: 'once' | 'always' | 'reject') => {
    const grantedOrigin = pendingOrigin;
    setPendingOrigin(undefined);
    if (!current || !currentSession()) return;
    const result = current.session.resolvePermission(decision !== 'reject');
    if (result?.kind !== 'respond') return;
    if (decision === 'always' && grantedOrigin && !result.response.error && currentSession()) {
      rememberDappReadGrant(grantedOrigin, current.selection.accountId, current.selection.networkId);
      rememberPersistentAccess?.(grantedOrigin, current.selection.accountId, current.selection.networkId);
    }
    reply(result.response);
  };

  const shouldLoad = (candidate: string) => {
    if (!current || !active || stale) return false;
    if (candidate === 'about:blank') return true;
    return readPublicDappNavigation(candidate) !== undefined;
  };

  const onDocumentStart = (nextUrl: string) => {
    if (!current || !currentSession() || nextUrl === 'about:blank') return;
    const target = readPublicDappNavigation(nextUrl);
    if (!target) return;
    documentEpoch.current += 1;
    documentOrigin.current = target.origin;
    current.session.activateDocument(target.origin);
    signGeneration.current += 1;
    setPendingOrigin(undefined);
    setPendingSign(undefined);
    setSignError(false);
  };

  const onNavigation = (next: DappBrowserNavigation) => {
    if (!current || !active || stale || next.url === 'about:blank') return;
    const target = readPublicDappNavigation(next.url);
    if (!target) return;
    setPage({ origin: target.origin, canGoBack: next.canGoBack, canGoForward: next.canGoForward });
  };

  const close = () => {
    current?.session.revoke();
    onClose();
  };

  if (!current || stale || !active) {
    return (
      <Screen>
        <NativeButton label={t('common.back')} onPress={close} variant="quiet" />
        <Text style={styles.error}>{t('dapps.browser.unavailable')}</Text>
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
              onPress={() => surface.current?.goBack()}
              styles={styles}
            />
            <ToolButton
              disabled={!page.canGoForward}
              glyph="›"
              label={t('dapps.browser.forward')}
              onPress={() => surface.current?.goForward()}
              styles={styles}
            />
            <ToolButton
              glyph="↻"
              label={t('dapps.browser.reload')}
              onPress={() => surface.current?.reload()}
              styles={styles}
            />
          </View>
          <Text selectable numberOfLines={1} style={styles.origin}>
            {shownOrigin}
          </Text>
          <ToolButton glyph="×" label={t('dapps.browser.close')} onPress={close} styles={styles} />
        </View>
        <Text style={styles.notice}>{t('dapps.browser.noSigning')}</Text>
        <View style={styles.browser}>
          <BrowserSurface
            ref={surface}
            url={current.url}
            nonce={current.token}
            onMessage={handleMessage}
            onNavigation={onNavigation}
            onDocumentStart={onDocumentStart}
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
        {pendingSign ? (
          <DappSignSheet
            intent={pendingSign.intent}
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
      <Text style={styles.toolGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function networkLabel(networkId: string): string {
  if (networkId === 'stellar-testnet') return 'Testnet';
  if (networkId === 'stellar-mainnet') return 'Mainnet';
  return networkId;
}
