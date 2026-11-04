import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { RequestCameraPermissionState } from '@capabilities/request/RequestIngressPort';
import { BottomSheet } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { scannedContactRecipient, type ContactBook, type ContactScanner, type Recipient } from './contactBook';
import { createStyles } from './styles';

type PermissionState = RequestCameraPermissionState | 'checking' | 'error';

export function RecipientScanSheet({
  book,
  scanner,
  active,
  onSelect,
  onClose,
}: Readonly<{
  book: ContactBook;
  scanner: ContactScanner;
  active: boolean;
  onSelect(recipient: Recipient): void;
  onClose(): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [error, setError] = useState<string>();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const live = useRef(true);
  const activeRef = useRef(active);
  const attempt = useRef(0);
  const handled = useRef(false);
  activeRef.current = active;

  const begin = useCallback(async () => {
    const currentAttempt = ++attempt.current;
    handled.current = false;
    setPermission('checking');
    setError(undefined);
    try {
      const current = await scanner.ingress.checkCameraPermission();
      if (!live.current || !activeRef.current || currentAttempt !== attempt.current) return;
      const granted = current === 'denied' ? await scanner.ingress.requestCameraPermission() : current;
      if (!live.current || !activeRef.current || currentAttempt !== attempt.current) return;
      setPermission(granted);
    } catch {
      if (!live.current || !activeRef.current || currentAttempt !== attempt.current) return;
      setPermission('error');
      setError(t('contacts.scan.cameraError'));
    }
  }, [scanner.ingress, t]);

  useEffect(() => {
    live.current = true;
    void begin();
    return () => {
      live.current = false;
      attempt.current += 1;
    };
  }, [begin]);

  const close = () => {
    if (!live.current || !activeRef.current) return;
    attempt.current += 1;
    handled.current = true;
    onClose();
  };
  const scanAttempt = attempt.current;
  const onCode = (value: string) => {
    if (!live.current || !activeRef.current || scanAttempt !== attempt.current || permission !== 'granted' || handled.current) return;
    handled.current = true;
    try {
      const recipient = scannedContactRecipient(book, value);
      attempt.current += 1;
      onSelect(recipient);
    } catch {
      if (!live.current || !activeRef.current || scanAttempt !== attempt.current) return;
      setError(t('contacts.scan.invalid'));
      setPermission('error');
    }
  };
  const onScannerError = () => {
    if (!live.current || !activeRef.current || scanAttempt !== attempt.current || permission !== 'granted' || handled.current) return;
    handled.current = true;
    setError(t('contacts.scan.cameraError'));
    setPermission('error');
  };

  const ScannerView = scanner.ScannerView;
  return (
    <BottomSheet visible onClose={close} closeLabel={t('common.cancel')}>
      <View style={styles.scanContent}>
        <Text accessibilityRole="header" style={styles.title}>{t('contacts.scan.title')}</Text>
        <Text style={styles.hint}>{t('send.scan.purpose')}</Text>
        {permission === 'granted' ? (
          <View style={styles.scanFrame}>
            <ScannerView
              active={active && live.current && scanAttempt === attempt.current}
              torchEnabled={torchEnabled}
              onCode={onCode}
              onError={onScannerError}
            />
          </View>
        ) : (
          <Text accessibilityRole="alert" style={styles.hint}>
            {error ?? t(permission === 'checking' ? 'contacts.scan.checking' : 'contacts.scan.permission')}
          </Text>
        )}
        {permission === 'granted' ? (
          <NativeButton
            label={t(torchEnabled ? 'request.ingress.scan.torchOff' : 'request.ingress.scan.torchOn')}
            variant="quiet"
            onPress={() => setTorchEnabled(value => !value)}
          />
        ) : permission === 'error' || permission === 'denied' || permission === 'blocked' ? (
          <NativeButton label={t('activity.retry')} variant="quiet" onPress={() => void begin()} />
        ) : null}
        {permission === 'blocked' ? (
          <NativeButton
            label={t('contacts.scan.settings')}
            variant="quiet"
            onPress={() => {
              const currentAttempt = attempt.current;
              void scanner.ingress.openCameraSettings().catch(() => {
                if (live.current && activeRef.current && currentAttempt === attempt.current) {
                  setError(t('contacts.scan.cameraError'));
                }
              });
            }}
          />
        ) : null}
        <NativeButton label={t('common.cancel')} variant="quiet" onPress={close} />
      </View>
    </BottomSheet>
  );
}
