import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  disableSystemAuth,
  enableSystemAuth,
  getSystemAuthStatus,
  type ApplicationSecurityDependencies,
  type SystemAuthStatus,
} from '../../capabilities/application-security/systemAuth';

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
      setAppPassphrase('');
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
          `${result.failedSignerPublicKeys.length} signer(s) could not be registered. Check that the passphrase matches the wallet and retry.`,
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
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={onClose}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.eyebrow}>Application Security</Text>
      <Text style={styles.title}>System Auth</Text>
      <Text style={styles.body}>
        Face ID, Touch ID, or strong Android biometrics can authorize routine
        signing. Your app passphrase remains the higher-privilege recovery and
        security credential.
      </Text>

      {!status ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.card}>
          <StatusRow label="Available on this device" value={status.available ? 'Yes' : 'No'} />
          <StatusRow label="Protection domain" value={status.domainInitialized ? 'Ready' : 'Not set up'} />
          <StatusRow
            label="Registered software signers"
            value={`${status.enrolledSignerCount} / ${status.protectedSignerCount}`}
          />
        </View>
      )}

      {status?.protectedSignerCount ? (
        <>
          <Text style={styles.label}>App passphrase</Text>
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            placeholder="Enter your current app passphrase"
            value={appPassphrase}
            onChangeText={setAppPassphrase}
            style={styles.input}
          />
          <Text style={styles.hint}>
            The passphrase is sent only to the Fresnica native boundary to
            verify and register each protected signer. It is not persisted.
          </Text>
          <PrimaryButton
            label={status.domainInitialized ? 'Register / repair signers' : 'Enable System Auth'}
            disabled={busy || !status.available || appPassphrase.length === 0}
            onPress={() => void enable()}
          />
          {status.domainInitialized ? (
            <SecondaryButton
              label="Disable System Auth"
              disabled={busy}
              onPress={() => void disable()}
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.hint}>
          System Auth registration applies to protected software signers. A
          watch-only wallet has no local signer to register.
        </Text>
      )}

      {busy ? <ActivityIndicator /> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>App session lock</Text>
        <Text style={styles.hint}>
          Session lock is intentionally not enabled yet. The current Fresnica RN
          adapter has no safe passphrase-verification-only API or generic System
          Auth challenge for app-session unlock. Fresnica Mobile will not use
          Reveal, dummy signing, or a second JavaScript KDF as a workaround.
        </Text>
      </View>
    </ScrollView>
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

function PrimaryButton(props: {label: string; disabled?: boolean; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.primaryButton, props.disabled ? styles.disabled : undefined]}>
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: {label: string; disabled?: boolean; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.secondaryButton, props.disabled ? styles.disabled : undefined]}>
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to update security settings.';
}

const styles = StyleSheet.create({
  screen: {flexGrow: 1, padding: 24, paddingTop: 64, gap: 16},
  back: {fontSize: 16, fontWeight: '600'},
  eyebrow: {fontSize: 13, fontWeight: '600', textTransform: 'uppercase'},
  title: {fontSize: 30, fontWeight: '700'},
  body: {fontSize: 16, lineHeight: 24},
  card: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 12},
  cardTitle: {fontSize: 17, fontWeight: '700'},
  statusRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 16},
  statusLabel: {fontSize: 14, flex: 1},
  statusValue: {fontSize: 14, fontWeight: '700'},
  label: {fontSize: 14, fontWeight: '600'},
  input: {borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16},
  hint: {fontSize: 13, lineHeight: 19},
  primaryButton: {borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center'},
  primaryButtonText: {fontSize: 16, fontWeight: '700'},
  secondaryButton: {borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center'},
  secondaryButtonText: {fontSize: 16, fontWeight: '600'},
  disabled: {opacity: 0.5},
  notice: {fontSize: 14, lineHeight: 20},
  error: {fontSize: 14, fontWeight: '600'},
});
