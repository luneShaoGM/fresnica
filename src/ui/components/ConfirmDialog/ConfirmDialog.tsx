import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useAppTheme, useThemedStyles } from '@ui/theme';

import { AppModal } from '../AppModal';
import { createStyles } from './styles';

export type ConfirmDialogProps = Readonly<{
  visible: boolean;
  title: string;
  message: string;
  detail?: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel?: string;
  error?: string;
  variant?: 'default' | 'destructive';
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>;

export function ConfirmDialog({
  visible,
  title,
  message,
  detail,
  cancelLabel,
  confirmLabel,
  busyLabel,
  error,
  variant = 'default',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  const destructive = variant === 'destructive';
  const stackActions = cancelLabel.length + confirmLabel.length > 18;

  const cancel = () => {
    if (visible && !busy) onCancel();
  };
  const confirm = () => {
    if (visible && !busy) onConfirm();
  };

  const cancelAction = (
    <Pressable
      accessibilityLabel={cancelLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy }}
      disabled={busy}
      onPress={cancel}
      style={({ pressed }) => [
        styles.action,
        stackActions ? styles.stackedAction : styles.rowAction,
        styles.cancelAction,
        pressed && !busy ? styles.pressed : undefined,
        busy ? styles.disabled : undefined,
      ]}
    >
      <Text style={styles.cancelText}>{cancelLabel}</Text>
    </Pressable>
  );
  const confirmAction = (
    <Pressable
      accessibilityLabel={busy && busyLabel ? busyLabel : confirmLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={confirm}
      style={({ pressed }) => [
        styles.action,
        stackActions ? styles.stackedAction : styles.rowAction,
        destructive ? styles.destructiveAction : styles.primaryAction,
        pressed && !busy ? styles.pressed : undefined,
        busy ? styles.disabled : undefined,
      ]}
    >
      {busy ? <ActivityIndicator color={theme.colors.onActionPrimary} size="small" /> : null}
      <Text style={styles.confirmText}>{busy && busyLabel ? busyLabel : confirmLabel}</Text>
    </Pressable>
  );

  return (
    <AppModal dialogStyle={styles.surface} onRequestClose={cancel} visible={visible}>
      <View style={styles.content}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.statusIcon, destructive ? styles.destructiveIcon : styles.warningIcon]}
        >
          <Text style={[styles.statusGlyph, destructive ? styles.destructiveTitle : styles.warningTitle]}>i</Text>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.title, destructive ? styles.destructiveTitle : styles.warningTitle]}
        >
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <View style={[styles.actions, stackActions ? styles.actionsColumn : styles.actionsRow]}>
          {stackActions ? (
            <>
              {confirmAction}
              {cancelAction}
            </>
          ) : (
            <>
              {cancelAction}
              {confirmAction}
            </>
          )}
        </View>
      </View>
    </AppModal>
  );
}
