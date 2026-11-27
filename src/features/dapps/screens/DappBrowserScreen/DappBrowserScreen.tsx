import type { DappCatalogEntry, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import { DappCatalogIcon } from '../../DappCatalogIcon';
import { DappDetailSheet } from '../../DappDetailSheet';
import { createStyles as createDetailStyles } from '../DAppsScreen/styles';
import type { DappContractTracking } from '@capabilities/dapp-interaction/dappContractTracking';
import React, { useCallback, useEffect, useRef, useState, type ComponentType, type RefAttributes } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
import type { DappAssetRequest, ReviewedDappAsset } from '../../../../capabilities/dapp-interaction/dappAssetRequest';
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
import type { AccountRecord } from '@capabilities/account/types';
import { useLocalization } from '../../../../locale';
import { BottomSheet, Screen } from '../../../../ui/components';
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
  accountChoices?: readonly AccountRecord[];
  onSwitchAccount?: (id: string, origin: string) => Promise<void>;
  onSwitchNetwork?: () => void;
  catalogEntry?: DappCatalogEntry;
  catalogMedia?: DappCatalogPort['publicMedia'];
  online?: boolean;
  shareWebsite?: (origin: string) => Promise<unknown>;
  notificationNow?: () => number;
  showNotification?: (origin: string, title: string, body: string, expiresAt: number) => boolean;
  currentSelection: () => DappPublicSelection | undefined;
  subscribeSelection: (listener: () => void) => () => void;
  createNonce: () => string;
  signTransaction: DappTransactionSigner;
  signMessage?: DappMessageSigner;
  addAsset?: DappAssetRequest;
  trackContract?: DappContractTracking;
  permissions: DappPermissionStore;
  // One-use proof consumed by App composition; not a route param or grant.
  requireFreshConnection?: boolean;
  trustedCatalogOrigin?: string;
  BrowserSurface: ComponentType<DappBrowserSurfaceProps & RefAttributes<DappBrowserSurfaceHandle>>;
}>;

type PendingSignature = Readonly<{
  transactionXdrBase64: string;
  origin: string;
  intent: DappTransactionIntent;
  target?: DappMessageReplyTarget;
  asset?: ReviewedDappAsset;
  documentEpoch: number;
  generation: number;
  passphraseRequired: boolean;
}>;

type PendingContract = Extract<BridgeDecision, { kind: 'track-contract' }> & {
  generation: number;
  epoch: number;
  target: DappMessageReplyTarget;
};

type PendingMessage = Extract<BridgeDecision, { kind: 'sign-message' }> & {
  generation: number;
  epoch: number;
  target: DappMessageReplyTarget;
};

type PendingPermission = Readonly<{
  origin: string;
  documentEpoch: number;
  target?: DappMessageReplyTarget;
}>;

export function DappBrowserScreen({
  url,
  active,
  onClose,
  onVisit,
  shareWebsite,
  catalogEntry,
  catalogMedia,
  online = true,
  accountChoices,
  onSwitchAccount,
  onSwitchNetwork,
  showNotification,
  notificationNow,
  currentSelection,
  subscribeSelection,
  createNonce,
  signTransaction,
  signMessage,
  addAsset,
  trackContract,
  permissions,
  trustedCatalogOrigin,
  requireFreshConnection,
  BrowserSurface,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const detailStyles = useThemedStyles(createDetailStyles);
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
  const [pendingPermission, setPendingPermission] = useState<PendingPermission>();
  const permissionRequest = useRef<PendingPermission | undefined>(undefined);
  const permissionDocumentActive = useRef(true);
  const permissionHistoryPending = useRef(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [switchFailed, setSwitchFailed] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [, setConnectionRevision] = useState(0);
  const [page, setPage] = useState<{ origin: string; title?: string; canGoBack: boolean; canGoForward: boolean }>({
    origin: '',
    canGoBack: false,
    canGoForward: false,
  });
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
  const [pendingContract, setPendingContract] = useState<PendingContract>();
  const contractAbort = useRef<AbortController | undefined>(undefined);
  const clearContract = () => {
    if (contractAbort.current) {
      contractAbort.current.abort();
      contractAbort.current = undefined;
      setSigningNow(false);
    }
    setPendingContract(undefined);
  };
  const [pendingMessage, setPendingMessage] = useState<PendingMessage>();
  const [messageExpired, setMessageExpired] = useState(false);
  const [signingNow, setSigningNow] = useState(false);
  const messageReplyTarget = useRef<DappMessageReplyTarget | undefined>(undefined);
  const originChanging = useRef(false);
  const documentEpoch = useRef(0);
  const documentOrigin = useRef<string | undefined>(undefined);
  const signGeneration = useRef(0);
  const signing = useRef(false);
  const curatedDocument = useRef<'unconfirmed' | 'confirmed' | 'retired'>('unconfirmed');
  const hasDocumentStarted = useRef(false);
  const [signError, setSignError] = useState(false);
  const [uncertainAssetHashes, setUncertainAssetHashes] = useState<string[]>([]);
  const [permissionStorageError, setPermissionStorageError] = useState<'grant' | 'revoke'>();
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
            persistedAllowed: requireFreshConnection ? undefined : hasSavedGrant,
            catalogReadAllowed: () =>
              trustedInitialOrigin &&
              curatedDocument.current === 'confirmed' &&
              documentOrigin.current === target.origin,
            persistedNotificationAllowed: requireFreshConnection ? undefined : hasSavedGrant,
            notificationNow,
          }),
        });
      }
    } catch {
      // Bad route/entropy/account fails closed without initializing WebView.
    }
  }
  const current = initial.current;
  const settlePermission = useCallback(
    (approve = false) => {
      permissionRequest.current = undefined;
      setPendingPermission(undefined);
      return current?.session.resolvePermission(approve);
    },
    [current],
  );

  const retirePermissionDocument = () => {
    // An early navigation event retires consent before a new document starts.
    permissionDocumentActive.current = false;
    permissionHistoryPending.current = false;
    settlePermission();
  };

  useEffect(() => {
    if (!current) return;
    const unsubscribe = subscribeSelection(() => {
      // The owner publishes monotonic revisions. Even A->B->A revokes the
      // original dApp connection and unmounts the WebView on first change.
      current.session.revoke();
      contractAbort.current?.abort();
      setStale(true);
    });
    return () => {
      unsubscribe();
      contractAbort.current?.abort();
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
        contractAbort.current?.abort();
        signGeneration.current += 1;
        settlePermission();
        setPendingSign(undefined);
        setPendingMessage(undefined);
        setStale(true);
      }
    });
  }, [current, permissions, settlePermission]);

  useEffect(() => {
    if (!active && current) {
      current.session.revoke();
      contractAbort.current?.abort();
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

  const transactionTarget = useRef<DappMessageReplyTarget | undefined>(undefined);
  const transactionDeadline = useRef(0);
  const transactionExpired = (target: DappMessageReplyTarget) =>
    performance.now() >= transactionDeadline.current ||
    (target.expiresAt !== undefined && Date.now() >= target.expiresAt);

  const expireTransaction = (target: DappMessageReplyTarget) => {
    if (!currentSession() || transactionTarget.current?.replyId !== target.replyId) return;
    transactionTarget.current = undefined;
    clearContract();
    signGeneration.current += 1;
    setPendingSign(undefined);
    setSignError(false);
    const expired = current?.session.finishSign({ status: 'failed', error: 'request-expired' });
    if (expired) reply(expired, target);
  };

  const handleReplyExpired = (replyId: string, origin: string) => {
    if (!currentSession() || documentOrigin.current !== origin) return;
    if (permissionRequest.current?.target?.replyId === replyId) {
      settlePermission();
      return;
    }
    const transaction = transactionTarget.current;
    if (transaction?.replyId === replyId) {
      expireTransaction(transaction);
      return;
    }
    const target = messageReplyTarget.current;
    if (!target || target.replyId !== replyId) return;
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

  useEffect(() => {
    const target = pendingSign?.target;
    if (!target) return;
    const remaining = Math.min(
      transactionDeadline.current - performance.now(),
      target.expiresAt === undefined ? Infinity : target.expiresAt - Date.now(),
    );
    const timer = setTimeout(() => expireTransaction(target), Math.max(0, remaining));
    return () => clearTimeout(timer);
  });

  const handleMessage = (
    raw: string,
    messageUrl: string,
    replyId?: string,
    replyExpiresAt?: number,
    firstCommittedDocumentUrl?: string,
  ) => {
    if (!current || !active || stale || originChanging.current) return;
    if (curatedDocument.current !== 'retired') {
      const verified = firstCommittedDocumentUrl && readPublicDappNavigation(firstCommittedDocumentUrl);
      const status = !verified ? 'unconfirmed' : verified.url === current.url ? 'confirmed' : 'retired';
      if (status !== curatedDocument.current) {
        curatedDocument.current = status;
        if (trustedCatalogOrigin) setConnectionRevision(revision => revision + 1);
      }
    }
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
    if (decision.kind === 'permission') {
      if (!permissionDocumentActive.current) {
        settlePermission();
        return;
      }
      const request = { origin: decision.origin, documentEpoch: documentEpoch.current, target };
      permissionRequest.current = request;
      setPendingPermission(request);
    }
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
    if (decision.kind === 'track-contract') {
      if (!target || !trackContract?.canReview(current.selection, decision.contractId)) {
        const failed = current.session.finishSign({ status: 'failed', error: 'asset-failed' });
        if (failed && target) reply(failed, target);
        return;
      }
      transactionTarget.current = target;
      transactionDeadline.current = performance.now() + 120_000;
      if (transactionExpired(target)) {
        expireTransaction(target);
        return;
      }
      setPendingContract({ ...decision, generation: ++signGeneration.current, epoch: documentEpoch.current, target });
      return;
    }
    if (decision.kind === 'add-asset') {
      const generation = ++signGeneration.current;
      const epoch = documentEpoch.current;
      if (!target || !addAsset) {
        const failed = current.session.finishSign({ status: 'failed', error: 'asset-failed' });
        if (failed && target) reply(failed, target);
        return;
      }
      transactionTarget.current = target;
      transactionDeadline.current = performance.now() + 120_000;
      if (transactionExpired(target)) {
        expireTransaction(target);
        return;
      }
      void (async () => {
        let asset: ReviewedDappAsset | undefined;
        try {
          asset = await addAsset(current.selection, decision);
        } catch {
          // Do not expose wallet or upstream errors to the page.
        }
        if (!currentSession() || generation !== signGeneration.current || epoch !== documentEpoch.current) return;
        if (transactionExpired(target)) {
          expireTransaction(target);
          return;
        }
        if (!asset) {
          transactionTarget.current = undefined;
          const failed = current.session.finishSign({ status: 'failed', error: 'asset-failed' });
          if (failed) reply(failed, target);
          return;
        }
        setSignError(false);
        setPendingSign({
          origin: decision.origin,
          intent: asset.intent,
          transactionXdrBase64: '',
          documentEpoch: epoch,
          generation,
          passphraseRequired: true,
          target,
          asset,
        });
      })();
    }
    if (decision.kind === 'sign-transaction') {
      transactionTarget.current = target;
      transactionDeadline.current = performance.now() + 120_000;
      const generation = signGeneration.current + 1;
      signGeneration.current = generation;
      inspectSignature(decision, generation, target).catch(() => undefined);
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
    target?: DappMessageReplyTarget,
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
    if (target && transactionExpired(target)) {
      expireTransaction(target);
      return;
    }
    if (inspected.status === 'ready' && !target) {
      current.session.finishSign({ status: 'failed', error: 'invalid-transaction' });
      return;
    }
    if (inspected.status !== 'ready') {
      transactionTarget.current = undefined;
      const failed = current.session.finishSign({
        status: 'failed',
        error: inspected.status === 'unsupported-signer' ? 'unsupported-signer' : 'invalid-transaction',
      });
      if (failed) reply(failed, target);
      return;
    }
    setPendingSign({
      transactionXdrBase64: decision.transactionXdrBase64,
      origin: decision.origin,
      intent: inspected.intent,
      ...(target === undefined ? {} : { target }),
      documentEpoch: documentEpoch.current,
      generation,
      passphraseRequired: true,
    });
  };

  const rejectSignature = () => {
    clearContract();
    signGeneration.current += 1;
    setPendingSign(undefined);
    setPendingMessage(undefined);
    setSignError(false);
    setMessageExpired(false);
    if (!current || !active || stale) return;
    const target = current.session.hasPendingMessage() ? messageReplyTarget.current : transactionTarget.current;
    transactionTarget.current = undefined;
    messageReplyTarget.current = undefined;
    const declined = current.session.finishSign({ status: 'declined' });
    if (declined) reply(declined, target);
  };

  const confirmContract = async (request: PendingContract) => {
    const isCurrent = () =>
      currentSession() &&
      !originChanging.current &&
      request.generation === signGeneration.current &&
      request.epoch === documentEpoch.current &&
      request.origin === documentOrigin.current &&
      request.target === transactionTarget.current &&
      !transactionExpired(request.target);
    if (!current || !trackContract || !isCurrent() || contractAbort.current) return;
    const controller = new AbortController();
    contractAbort.current = controller;
    setSigningNow(true);
    let ok = false;
    try {
      ok = await trackContract.track(current.selection, request.contractId, controller.signal, isCurrent);
    } catch {
      // Do not disclose account-store or RPC errors to the page.
    } finally {
      if (contractAbort.current === controller) {
        contractAbort.current = undefined;
        setSigningNow(false);
      }
    }
    if (!isCurrent() || controller.signal.aborted) return;
    setPendingContract(undefined);
    transactionTarget.current = undefined;
    const result = current.session.finishSign(
      ok ? { status: 'asset-added', contractId: request.contractId } : { status: 'failed', error: 'asset-failed' },
    );
    if (result) reply(result, request.target);
  };

  const confirmSignature = async (appPassphrase: string) => {
    if (!current || !pendingSign || signing.current || !currentSession()) return;
    const request = pendingSign;
    if (request.documentEpoch !== documentEpoch.current) return;
    if (request.target && transactionExpired(request.target)) {
      expireTransaction(request.target);
      return;
    }
    const generation = request.generation;
    const isCurrent = () =>
      transactionTarget.current === request.target &&
      !originChanging.current &&
      currentSession() &&
      generation === signGeneration.current &&
      request.documentEpoch === documentEpoch.current &&
      request.target !== undefined &&
      !transactionExpired(request.target);
    signing.current = true;
    setSigningNow(true);
    setSignError(false);
    try {
      if (!isCurrent()) return;
      if (request.asset) {
        if (!appPassphrase) return;
        const result = await request.asset.submit(appPassphrase, isCurrent);
        // A broadcast can outlive the website's reply, but still needs wallet recovery.
        if (result.status === 'submission-uncertain') {
          const { transactionHash } = result;
          setUncertainAssetHashes(hashes => (hashes.includes(transactionHash) ? hashes : [...hashes, transactionHash]));
        }
        if (!isCurrent()) return;
        if (result.status === 'passphrase-required') {
          setSignError(true);
          return;
        }
        transactionTarget.current = undefined;
        const completed = current.session.finishSign(
          result.status === 'added'
            ? { status: 'asset-added', contractId: request.asset.contractId }
            : { status: 'failed', error: result.status },
        );
        setPendingSign(undefined);
        if (completed) reply(completed, request.target);
        return;
      }
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
      transactionTarget.current = undefined;
      setPendingSign(undefined);
      if (completed) reply(completed, request.target);
    } catch (error) {
      if (!isCurrent()) return;
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'user-cancel') {
        const declined = current.session.finishSign({ status: 'declined' });
        transactionTarget.current = undefined;
        setPendingSign(undefined);
        if (declined) reply(declined, request.target);
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
    setShowConnection(false);
    setShowAbout(false);
    setShareFailed(false);
    curatedDocument.current = 'retired';
    const historyPending =
      action !== 'reload' && (permissionDocumentActive.current || permissionHistoryPending.current);
    retirePermissionDocument();
    permissionHistoryPending.current = historyPending;
    clearNotification();
    if (current?.session.hasPendingMessage() || pendingSign || transactionTarget.current) rejectSignature();
    surface.current?.[action]();
  };

  const choosePermission = (request: PendingPermission, decision: 'once' | 'always' | 'reject') => {
    if (!current || permissionRequest.current !== request) return;
    const { origin, target } = request;
    const isCurrentDocument = () =>
      permissionDocumentActive.current &&
      request.documentEpoch === documentEpoch.current &&
      origin === documentOrigin.current &&
      currentSession();
    if (!isCurrentDocument() || (target?.expiresAt !== undefined && Date.now() >= target.expiresAt)) {
      settlePermission();
      return;
    }
    const result = settlePermission(decision !== 'reject');
    if (result?.kind !== 'respond') return;
    if (!isCurrentDocument()) return;
    if (decision === 'always' && !result.response.error) {
      const scope: DappGrantScope = {
        origin,
        accountId: current.selection.accountId,
        networkId: current.selection.networkId,
      };
      try {
        permissions.grant(scope);
      } catch {
        reply(
          {
            source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
            messagedId: result.response.messagedId,
            error: 'permission-storage-failed',
          },
          target,
        );
        current.session.revoke();
        setPermissionStorageError('grant');
        setStale(true);
        return;
      }
    }
    reply(result.response, target);
  };

  const shouldLoad = (candidate: string) => {
    if (!current || !active || stale) return false;
    if (candidate === 'about:blank') return true;
    return readPublicDappNavigation(candidate) !== undefined;
  };

  const retireInvalidNavigation = () => {
    clearContract();
    // A navigation bypassing the normal URL gate must synchronously revoke
    // the bridge. Do not keep showing the previous, trusted address.
    current?.session.revoke();
    clearNotification();
    retirePermissionDocument();
    messageReplyTarget.current = undefined;
    transactionTarget.current = undefined;
    documentEpoch.current += 1;
    signGeneration.current += 1;
    setPendingSign(undefined);
    setPendingMessage(undefined);
    setSignError(false);
    setStale(true);
  };

  const onDocumentStart = (nextUrl: string) => {
    if (!current || !currentSession()) return;
    if (nextUrl === 'about:blank') {
      originChanging.current = true;
      setShowConnection(false);
      setShowAbout(false);
      setShareFailed(false);
      retirePermissionDocument();
      if (hasDocumentStarted.current || curatedDocument.current === 'confirmed') curatedDocument.current = 'retired';
      if (current.session.hasPendingMessage() || transactionTarget.current || pendingSign) rejectSignature();
      return;
    }
    const target = readPublicDappNavigation(nextUrl);
    if (!target) {
      retireInvalidNavigation();
      return;
    }
    setShowConnection(false);
    setShowAbout(false);
    setShareFailed(false);
    // A curated launch proves only its first exact main document. A reload,
    // a different path or a redirect drops implicit access forever, including
    // after navigating to another origin and back. SPA history is not a new
    // document and does not retire the first-document proof.
    if (curatedDocument.current !== 'retired') {
      curatedDocument.current = hasDocumentStarted.current || target.url !== current.url ? 'retired' : 'unconfirmed';
    }
    hasDocumentStarted.current = true;
    clearContract();
    clearNotification();
    settlePermission();
    messageReplyTarget.current = undefined;
    transactionTarget.current = undefined;
    documentEpoch.current += 1;
    originChanging.current = false;
    documentOrigin.current = target.origin;
    setPage(previous => ({ ...previous, origin: target.origin, title: undefined }));
    current.session.activateDocument(target.origin);
    permissionHistoryPending.current = false;
    permissionDocumentActive.current = true;
    if (currentSession()) onVisit?.(target.origin);
    signGeneration.current += 1;
    setPendingSign(undefined);
    setPendingMessage(undefined);
    setSignError(false);
    setMessageExpired(false);
  };

  const onNavigation = (next: DappBrowserNavigation) => {
    if (!current || !active || stale) return;
    if (next.url === 'about:blank') {
      retirePermissionDocument();
      return;
    }
    const target = readPublicDappNavigation(next.url);
    if (!target) {
      retireInvalidNavigation();
      return;
    }
    // Cross-origin navigation can arrive before the document-start event.
    if (target.origin !== documentOrigin.current) {
      originChanging.current = true;
      setShowConnection(false);
      setShowAbout(false);
      setShareFailed(false);
      retirePermissionDocument();
      clearNotification();
      if (current.session.hasPendingMessage() || transactionTarget.current || pendingSign) rejectSignature();
    } else if (permissionHistoryPending.current && next.sameDocumentHistory === true) {
      // Do not revive the retired approval or the directory's automatic access.
      // Only a native committed same-document history event can reopen manual consent.
      permissionHistoryPending.current = false;
      permissionDocumentActive.current = true;
    }
    if (target.origin !== current.origin) curatedDocument.current = 'retired';
    const title = next.title
      ?.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')
      .trim()
      .slice(0, 120);
    setPage({ origin: target.origin, title, canGoBack: next.canGoBack, canGoForward: next.canGoForward });
  };

  const close = () => {
    clearContract();
    current?.session.revoke();
    retirePermissionDocument();
    clearNotification();
    onClose();
  };

  if (!current || stale || !active) {
    return (
      <Screen>
        <NativeButton label={t('common.back')} onPress={close} variant="quiet" />
        <Text style={styles.error}>
          {switchFailed
            ? t('dapps.browser.switchFailed')
            : t(
                permissionStorageError === 'revoke'
                  ? 'dapps.browser.revokeFailed'
                  : permissionStorageError === 'grant'
                    ? 'dapps.permission.storageFailed'
                    : 'dapps.browser.unavailable',
              )}
        </Text>
      </Screen>
    );
  }

  const shownOrigin = page.origin || current.origin;
  const launchedCatalog =
    catalogEntry && readPublicDappNavigation(catalogEntry.websiteUrl)?.origin === shownOrigin
      ? catalogEntry
      : undefined;
  const siteTitle = page.title || launchedCatalog?.title || shownOrigin;

  const panelEpoch = documentEpoch.current;
  const ownsPanel = () =>
    currentSession() &&
    permissionDocumentActive.current &&
    !originChanging.current &&
    documentEpoch.current === panelEpoch &&
    documentOrigin.current === shownOrigin;
  const connected = ownsPanel() && current.session.isReadConnected();
  const disconnect = () => {
    if (!ownsPanel() || !current.session.isReadConnected()) return;
    const scope = {
      origin: shownOrigin,
      accountId: current.selection.accountId,
      networkId: current.selection.networkId,
    };
    // Stop the native session synchronously before changing durable consent.
    retireInvalidNavigation();
    try {
      permissions.revoke(scope);
    } catch {
      setPermissionStorageError('revoke');
      return;
    }
    onClose();
  };
  const shareOrigin = async () => {
    if (!shareWebsite || !ownsPanel()) return;
    setShareFailed(false);
    try {
      await shareWebsite(shownOrigin);
    } catch {
      if (ownsPanel()) setShareFailed(true);
    }
  };

  return (
    <Screen contentInset="none" scrollable={false}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.identity}>
            {launchedCatalog ? (
              <DappCatalogIcon entry={launchedCatalog} media={catalogMedia} styles={detailStyles} />
            ) : null}
            <View style={styles.identityText}>
              <Text numberOfLines={1} style={styles.title}>
                {siteTitle}
              </Text>
              {siteTitle !== shownOrigin ? (
                <Text selectable numberOfLines={1} style={styles.origin}>
                  {shownOrigin}
                </Text>
              ) : null}
            </View>
          </View>
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
          <ToolButton
            glyph="···"
            networkDot={current.selection.networkId === 'stellar-testnet' ? 'testnet' : 'mainnet'}
            label={t('dapps.browser.connection')}
            onPress={() => {
              setShowAccounts(false);
              setShowConnection(visible => !visible);
            }}
            styles={styles}
          />
          <ToolButton glyph="×" label={t('dapps.browser.close')} onPress={close} styles={styles} />
        </View>
        {showConnection && ownsPanel() ? (
          <ScrollView style={styles.recovery} contentContainerStyle={styles.permission}>
            <Text style={styles.heading}>
              {t(connected ? 'dapps.browser.connectedRead' : 'dapps.browser.disconnected')}
            </Text>
            <Text selectable style={styles.recoveryValue}>
              {shownOrigin}
            </Text>
            <Text style={styles.recoveryValue}>
              {t('dapps.permission.network')}: {networkLabel(current.selection.networkId)}
            </Text>
            {connected ? (
              <>
                <Text selectable style={styles.recoveryValue}>
                  {current.selection.address}
                </Text>
                <NativeButton label={t('dapps.browser.disconnect')} onPress={disconnect} variant="quiet" />
              </>
            ) : null}
            {onSwitchAccount &&
            accountChoices?.some(
              account =>
                account.id !== current.selection.accountId && account.networkId === current.selection.networkId,
            ) ? (
              <NativeButton
                label={t('dapps.browser.switchAccount')}
                onPress={() => setShowAccounts(value => !value)}
                variant="quiet"
              />
            ) : null}
            {showAccounts && onSwitchAccount
              ? accountChoices
                  ?.filter(
                    account =>
                      account.id !== current.selection.accountId && account.networkId === current.selection.networkId,
                  )
                  .map(account => (
                    <NativeButton
                      key={account.id}
                      label={account.address}
                      onPress={() => {
                        if (!ownsPanel() || signing.current || contractAbort.current) return;
                        retireInvalidNavigation();
                        onSwitchAccount(account.id, shownOrigin).catch(() => setSwitchFailed(true));
                      }}
                      variant="quiet"
                    />
                  ))
              : null}
            {onSwitchNetwork ? (
              <NativeButton
                label={t('dapps.browser.switchNetwork')}
                onPress={() => {
                  if (!ownsPanel() || signing.current || contractAbort.current) return;
                  retireInvalidNavigation();
                  onSwitchNetwork();
                }}
                variant="quiet"
              />
            ) : null}
            {launchedCatalog ? (
              <NativeButton
                label={t('dapps.browser.about')}
                onPress={() => {
                  if (!ownsPanel()) return;
                  setShowConnection(false);
                  setShowAbout(true);
                }}
                variant="quiet"
              />
            ) : null}
            {shareWebsite ? (
              <NativeButton
                label={t('dapps.browser.shareOrigin')}
                onPress={() => {
                  void shareOrigin();
                }}
                variant="quiet"
              />
            ) : null}
            {shareFailed ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {t('dapps.browser.shareFailed')}
              </Text>
            ) : null}
          </ScrollView>
        ) : null}
        {showAbout && launchedCatalog && ownsPanel() ? (
          <DappDetailSheet
            entry={launchedCatalog}
            media={catalogMedia}
            styles={detailStyles}
            active={active}
            online={online}
            siteOrigin={shownOrigin}
            networkLabel={networkLabel(current.selection.networkId)}
            onClose={() => setShowAbout(false)}
            onShare={
              shareWebsite
                ? () => {
                    void shareOrigin();
                  }
                : undefined
            }
          />
        ) : null}
        {uncertainAssetHashes.length > 0 ? (
          <ScrollView style={styles.recovery} contentContainerStyle={styles.permission}>
            <Text accessibilityRole="alert" style={styles.heading}>
              {t('dapps.sign.assetUncertain')}
            </Text>
            <Text style={styles.recoveryValue}>
              {t('dapps.permission.network')}: {networkLabel(current.selection.networkId)}
            </Text>
            <Text style={styles.recoveryValue}>{t('dapps.sign.hash')}</Text>
            {uncertainAssetHashes.map(hash => (
              <Text key={hash} selectable style={styles.recoveryValue}>
                {hash}
              </Text>
            ))}
          </ScrollView>
        ) : null}
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
        {pendingPermission ? (
          <DappConnectSheet
            address={current.selection.address}
            networkLabel={networkLabel(current.selection.networkId)}
            onAllowAlways={() => choosePermission(pendingPermission, 'always')}
            onAllowOnce={() => choosePermission(pendingPermission, 'once')}
            onReject={() => choosePermission(pendingPermission, 'reject')}
            origin={pendingPermission.origin}
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
        {pendingContract ? (
          <BottomSheet
            closeLabel={t('common.cancel')}
            onClose={() => {
              if (pendingContract.generation === signGeneration.current) rejectSignature();
            }}
            visible
          >
            <ScrollView contentContainerStyle={styles.permission}>
              <Text accessibilityRole="header" style={styles.heading}>
                {t('dapps.contract.title')}
              </Text>
              <Text selectable style={styles.recoveryValue}>
                {pendingContract.origin}
              </Text>
              <Text style={styles.recoveryValue}>
                {t('dapps.permission.network')}: {networkLabel(current.selection.networkId)}
              </Text>
              <Text selectable style={styles.recoveryValue}>
                {current.selection.address}
              </Text>
              <Text selectable style={styles.recoveryValue}>
                {pendingContract.contractId}
              </Text>
              <Text style={styles.notice}>{t('assets.contract.privacy')}</Text>
              <NativeButton
                label={t('dapps.contract.confirm')}
                disabled={signingNow}
                onPress={() => {
                  void confirmContract(pendingContract);
                }}
              />
              <NativeButton
                label={t('common.cancel')}
                variant="quiet"
                onPress={() => {
                  if (pendingContract.generation === signGeneration.current) rejectSignature();
                }}
              />
            </ScrollView>
          </BottomSheet>
        ) : null}
        {pendingSign ? (
          <DappSignSheet
            intent={pendingSign.intent}
            submitsAsset={pendingSign.asset !== undefined}
            network={networkLabel(current.selection.networkId)}
            expiresAt={pendingSign.target?.expiresAt}
            onExpired={() => {
              if (pendingSign.target) expireTransaction(pendingSign.target);
            }}
            busy={signingNow}
            onConfirm={passphrase => {
              confirmSignature(passphrase);
            }}
            failed={signError}
            onReject={() => {
              if (pendingSign.generation === signGeneration.current) rejectSignature();
            }}
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
  networkDot,
  glyph,
  label,
  onPress,
  styles,
}: Readonly<{
  disabled?: boolean;
  networkDot?: 'testnet' | 'mainnet';
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
      style={[styles.tool, networkDot ? styles.networkTool : undefined, disabled ? styles.toolDisabled : undefined]}
    >
      {networkDot ? (
        <View style={[styles.networkDot, networkDot === 'testnet' ? styles.testnetDot : styles.mainnetDot]} />
      ) : null}
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
