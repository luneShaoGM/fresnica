import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { saveContact, type ContactDraft } from '@capabilities/contacts/contacts';
import type { StellarPaymentMemo } from '@capabilities/stellar/types';
import { BottomSheet, Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import {
  contactError,
  contactShareUri,
  scannedContactRecipient,
  type ContactBook,
  type ContactScanner,
} from './contactBook';
import type { RequestCameraPermissionState } from '@capabilities/request/RequestIngressPort';
import { createStyles } from './styles';

type Props = Readonly<{
  book: ContactBook;
  initial?: ContactDraft;
  id?: string;
  onClose(): void;
  isCurrent?: () => boolean;
  scanner?: ContactScanner;
}>;
export function ContactEditor({ book, initial, id, onClose, isCurrent = () => true, scanner }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [memoType, setMemoType] = useState<'none' | StellarPaymentMemo['type']>(initial?.memo?.type ?? 'none');
  const [memoValue, setMemoValue] = useState(initial?.memo?.value ?? '');
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scanState, setScanState] = useState<'closed' | 'checking' | 'error' | RequestCameraPermissionState>('closed');
  const [scanError, setScanError] = useState<string>();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const scanSession = useRef(0);
  const scanHandled = useRef(false);
  const live = useRef(true);
  const deleting = useRef(false);
  const generation = useRef(0);
  const capturedGeneration = generation.current;
  useEffect(() => {
    const mountedScanSession = scanSession.current;
    live.current = true;
    return () => {
      live.current = false;
      // StrictMode effect replay before the first scan must not retire editor actions.
      if (scanSession.current !== mountedScanSession) scanSession.current += 1;
    };
  }, []);
  const available = () => live.current && isCurrent() && capturedGeneration === generation.current;
  const closeScanner = () => {
    scanSession.current += 1;
    setScanState('closed');
    setScanError(undefined);
    setTorchEnabled(false);
  };
  const close = () => {
    if (!available()) return;
    closeScanner();
    generation.current += 1;
    live.current = false;
    onClose();
  };
  const beginScan = async () => {
    if (
      !available() ||
      scanGeneration !== scanSession.current ||
      deleting.current ||
      !scanner ||
      scanState === 'checking' ||
      scanState === 'granted'
    )
      return;
    const session = ++scanSession.current;
    scanHandled.current = false;
    setScanState('checking');
    setScanError(undefined);
    try {
      const current = await scanner.ingress.checkCameraPermission();
      if (!available() || session !== scanSession.current) return;
      const permission = current === 'denied' ? await scanner.ingress.requestCameraPermission() : current;
      if (!available() || session !== scanSession.current) return;
      setScanState(permission);
    } catch {
      if (!available() || session !== scanSession.current) return;
      setScanState('error');
      setScanError(t('contacts.scan.cameraError'));
    }
  };
  const scanGeneration = scanSession.current;
  const scanned = (value: string) => {
    if (!available() || scanGeneration !== scanSession.current || scanState !== 'granted' || scanHandled.current)
      return;
    scanHandled.current = true;
    try {
      const recipient = scannedContactRecipient(book, value);
      setAddress(recipient.address);
      setMemoType(recipient.memo?.type ?? 'none');
      setMemoValue(recipient.memo?.value ?? '');
      setError(undefined);
      closeScanner();
    } catch {
      setScanError(t('contacts.scan.invalid'));
      setScanState('error');
    }
  };
  const scanFailure = () => {
    if (!available() || scanGeneration !== scanSession.current || scanState !== 'granted' || scanHandled.current)
      return;
    scanHandled.current = true;
    setScanError(t('contacts.scan.cameraError'));
    setScanState('error');
  };
  const retryCamera = () => {
    if (!available() || scanGeneration !== scanSession.current || scanState !== 'error' || !scanner) return;
    ++scanSession.current;
    scanHandled.current = false;
    setScanError(undefined);
    setScanState('granted');
  };
  const editorActionAvailable = () => available() && scanState === 'closed' && scanGeneration === scanSession.current;
  const save = () => {
    if (!editorActionAvailable() || deleting.current) return;
    try {
      if (id && !book.store.list(book.network.id).some(row => row.id === id)) throw new Error('contact-not-found');
      saveContact(
        book,
        book.network.id,
        { name, address, ...(memoType === 'none' ? {} : { memo: { type: memoType, value: memoValue } }) },
        id,
      );
      close();
    } catch (caught) {
      setError(contactError(caught, t));
    }
  };
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        {t(id ? 'contacts.edit' : 'contacts.add')}
      </Text>
      <Text style={styles.hint}>{t('contacts.local')}</Text>
      <Field
        label={t('contacts.name')}
        accessibilityLabel={t('contacts.name')}
        maxLength={30}
        value={name}
        onChangeText={setName}
      />
      <Field
        label={t('contacts.address')}
        accessibilityLabel={t('contacts.address')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={address}
        onChangeText={setAddress}
      />
      {scanner ? (
        <NativeButton label={t('contacts.scan.open')} variant="quiet" onPress={() => void beginScan()} />
      ) : null}
      <Text style={styles.hint}>{t('contacts.classicOnly')}</Text>
      <Text style={styles.title}>{t('contacts.memo')}</Text>
      <View style={styles.types}>
        {(['none', 'text', 'id', 'hash'] as const).map(type => (
          <NativeButton
            key={type}
            label={t(`send.memo.type.${type}`)}
            variant={memoType === type ? 'primary' : 'quiet'}
            size="sm"
            onPress={() => {
              if (type === memoType) return;
              setMemoType(type);
              setMemoValue('');
              setError(undefined);
            }}
          />
        ))}
      </View>
      {memoType !== 'none' ? (
        <Field
          label={t(`send.memo.input.${memoType}`)}
          accessibilityLabel={t(`send.memo.input.${memoType}`)}
          hint={t(`send.memo.hint.${memoType}`)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={memoType === 'id' ? 'number-pad' : 'default'}
          value={memoValue}
          onChangeText={setMemoValue}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <NativeButton label={t('contacts.save')} onPress={save} variant="primary" />
        <NativeButton label={t('common.cancel')} onPress={close} variant="quiet" />
        {id ? (
          <NativeButton
            label={t('contacts.share')}
            variant="quiet"
            onPress={async () => {
              if (!editorActionAvailable()) return;
              try {
                const contact = book.store.list(book.network.id).find(row => row.id === id);
                if (!contact) throw new Error('contact-not-found');
                await book.output.shareRequestUri(contactShareUri(book, contact));
              } catch (caught) {
                if (editorActionAvailable()) setError(contactError(caught, t));
              }
            }}
          />
        ) : null}
        {id && !confirmDelete ? (
          <NativeButton
            label={t('contacts.delete')}
            onPress={() => {
              if (editorActionAvailable() && !deleting.current) {
                generation.current += 1;
                deleting.current = true;
                setConfirmDelete(true);
              }
            }}
            variant="quiet"
          />
        ) : null}
      </View>
      {scanner && scanState !== 'closed' ? (
        <BottomSheet
          visible
          onClose={() => {
            if (scanGeneration === scanSession.current) closeScanner();
          }}
          closeLabel={t('common.cancel')}
        >
          <View style={styles.scanContent}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('contacts.scan.title')}
            </Text>
            <Text style={styles.hint}>{t('contacts.scan.purpose')}</Text>
            {scanState === 'granted' ? (
              <View style={styles.scanFrame}>
                <scanner.ScannerView
                  active={available() && scanGeneration === scanSession.current}
                  torchEnabled={torchEnabled}
                  onCode={scanned}
                  onError={scanFailure}
                />
              </View>
            ) : (
              <Text accessibilityRole="alert" style={styles.hint}>
                {scanError ?? t(scanState === 'checking' ? 'contacts.scan.checking' : 'contacts.scan.permission')}
              </Text>
            )}
            {scanState === 'granted' ? (
              <NativeButton
                label={t(torchEnabled ? 'request.ingress.scan.torchOff' : 'request.ingress.scan.torchOn')}
                variant="quiet"
                onPress={() => setTorchEnabled(value => !value)}
              />
            ) : scanState === 'error' ? (
              <NativeButton label={t('activity.retry')} onPress={retryCamera} variant="quiet" />
            ) : scanState !== 'checking' ? (
              <>
                <NativeButton label={t('activity.retry')} onPress={() => void beginScan()} variant="quiet" />
                {scanState === 'blocked' ? (
                  <NativeButton
                    label={t('contacts.scan.settings')}
                    variant="quiet"
                    onPress={() => {
                      const session = scanSession.current;
                      void scanner.ingress.openCameraSettings().catch(() => {
                        if (available() && session === scanSession.current)
                          setScanError(t('contacts.scan.cameraError'));
                      });
                    }}
                  />
                ) : null}
              </>
            ) : null}
            <NativeButton
              label={t('common.cancel')}
              variant="quiet"
              onPress={() => {
                if (scanGeneration === scanSession.current) closeScanner();
              }}
            />
          </View>
        </BottomSheet>
      ) : null}
      {confirmDelete ? (
        <View style={styles.confirmation} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            {t('contacts.deleteConfirm')}
          </Text>
          <Text style={styles.hint}>{t('contacts.deleteDetail')}</Text>
          <NativeButton
            label={t('contacts.keep')}
            variant="quiet"
            onPress={() => {
              if (!available() || !deleting.current) return;
              generation.current += 1;
              deleting.current = false;
              setConfirmDelete(false);
            }}
          />
          <NativeButton
            label={t('contacts.delete')}
            variant="primary"
            onPress={() => {
              if (!available() || !deleting.current || !id) return;
              try {
                book.store.remove(book.network.id, id);
                close();
              } catch (caught) {
                setError(contactError(caught, t));
              }
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
