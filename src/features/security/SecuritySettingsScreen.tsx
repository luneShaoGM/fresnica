import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {
  disableSystemAuth,
  enableSystemAuth,
  getSystemAuthStatus,
  type ApplicationSecurityDependencies,
  type SystemAuthStatus,
} from '../../capabilities/application-security/systemAuth';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Field} from '../../ui/Field';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  dependencies: ApplicationSecurityDependencies;
  onClose: () => void;
}>;

export function SecuritySettingsScreen({dependencies, onClose}: Props) {
  const [status, setStatus] = useState<SystemAuthStatus>();
  const [appPassphrase, setAppPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    let mounted = true;
    void getSystemAuthStatus(dependencies)
      .then(next => {
        if (mounted) setStatus(next);
      })
      .catch(caught => {
        if (mounted) setError(readableError(caught));
      });
    return () => {
      mounted = false;
    };
  }, [dependencies]);

  async function enable() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await enableSystemAuth(dependencies, {
        appPassphrase,
        reason: 'Enable Fresnica System Auth',
      });
      setStatus(result.status);
      setAppPassphrase('');
      if (result.failedSignerPublicKeys.length > 0) {
        setNotice(
          `${result.failedSignerPublicKeys.length} signer(s) could not be registered. Verify that this is the same app passphrase used when the wallet was created or imported, then retry.`,
        );
      } else {
        setNotice('System Auth is ready for routine signing.');
      }
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const next = await disableSystemAuth(dependencies);
      setStatus(next);
      setAppPassphrase('');
      setNotice('System Auth has been disabled for Fresnica signers on this device.');
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      eyebrow="Application Security"
      title="System Auth"
      description="Use Face ID, Touch ID, or strong Android biometrics for routine signing while keeping your app passphrase as the higher-privilege recovery credential."
      keyboardShouldPersistTaps="handled"
      leading={<Button label="Back" variant="ghost" onPress={onClose} />}>
      {!status ? (
        <ActivityIndicator />
      ) : (
        <Card title="Device authorization">
          <StatusRow label="Available on this device" value={status.available ? 'Yes' : 'No'} />
          <StatusRow label="Protection domain" value={status.domainInitialized ? 'Ready' : 'Not set up'} />
          <StatusRow
            label="Registered software signers"
            value={`${status.enrolledSignerCount} / ${status.protectedSignerCount}`}
          />
        </Card>
      )}

      {status?.protectedSignerCount ? (
        <Card
          title={status.domainInitialized ? 'Signer authorization' : 'Enable System Auth'}
          description="Your current app passphrase is verified only at the Fresnica native boundary and is never persisted.">
          <Field
            label="Current app passphrase"
            hint="Use the same passphrase you set when this protected wallet was created or imported. This does not create a new passphrase."
            autoCapitalize="none"
            secureTextEntry
            placeholder="Enter current app passphrase"
            value={appPassphrase}
            onChangeText={setAppPassphrase}
          />
          <Button
            label={status.domainInitialized ? 'Register / repair signers' : 'Enable System Auth'}
            disabled={busy || !status.available || appPassphrase.length === 0}
            onPress={() => void enable()}
          />
          {status.domainInitialized ? (
            <Button
              label="Disable System Auth"
              variant="secondary"
              disabled={busy}
              onPress={() => void disable()}
            />
          ) : null}
        </Card>
      ) : (
        <Card description="System Auth applies to protected software signers. A watch-only wallet has no local signer to register." />
      )}

      {busy ? <ActivityIndicator /> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Card
        title="App session lock"
        description="Not enabled yet. The current Fresnica RN adapter has no safe passphrase-verification-only API or generic System Auth challenge for app-session unlock. Fresnica Mobile will not use Reveal, dummy signing, or a second JavaScript KDF as a workaround."
      />
    </Screen>
  );
}

function StatusRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to update security settings.';
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusLabel: {
    ...typography.caption,
    color: palette.textMuted,
    flex: 1,
  },
  statusValue: {
    ...typography.label,
    color: palette.text,
  },
  notice: {
    ...typography.caption,
    color: palette.success,
  },
  error: {
    ...typography.caption,
    color: palette.danger,
    fontWeight: '600',
  },
});
