import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
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
          `${result.failedSignerPublicKeys.length} signer(s) could not be registered. Verify the current app passphrase and retry.`,
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" disabled={busy} onPress={onClose} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>SYSTEM AUTH</Text>
        {!status ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color="#00CA8A" />
          </View>
        ) : (
          <View style={styles.rows}>
            <StatusRow label="Available on this device" value={status.available ? 'Yes' : 'No'} />
            <StatusRow label="Protection domain" value={status.domainInitialized ? 'Ready' : 'Not set up'} />
            <StatusRow
              label="Registered software signers"
              value={`${status.enrolledSignerCount} / ${status.protectedSignerCount}`}
            />
            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.rowLabel}>Use biometrics for routine signing</Text>
                <Text style={styles.rowDescription}>Face ID, Touch ID, or strong Android biometrics</Text>
              </View>
              <Switch
                disabled
                trackColor={{false: '#E7EAF0', true: 'rgba(0, 202, 138, 0.35)'}}
                thumbColor={status.domainInitialized ? '#00CA8A' : '#FFFFFF'}
                value={status.domainInitialized}
              />
            </View>
          </View>
        )}

        {status?.protectedSignerCount ? (
          <>
            <Text style={styles.sectionLabel}>
              {status.domainInitialized ? 'SIGNER AUTHORIZATION' : 'ENABLE SYSTEM AUTH'}
            </Text>
            <View style={styles.passphraseBlock}>
              <Text style={styles.passphraseHint}>
                Enter the same app passphrase used when this protected wallet was created or imported. It is verified only at the Fresnica native boundary and is never persisted.
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                onChangeText={setAppPassphrase}
                placeholder="Current app passphrase"
                placeholderTextColor="#ACB1C1"
                secureTextEntry
                style={styles.input}
                value={appPassphrase}
              />
              <Pressable
                disabled={busy || !status.available || appPassphrase.length === 0}
                onPress={() => void enable()}
                style={({pressed}) => [
                  styles.primaryButton,
                  busy || !status.available || appPassphrase.length === 0 ? styles.disabled : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <Text style={styles.primaryButtonText}>
                  {status.domainInitialized ? 'Register / repair signers' : 'Enable System Auth'}
                </Text>
              </Pressable>
              {status.domainInitialized ? (
                <Pressable
                  disabled={busy}
                  onPress={() => void disable()}
                  style={({pressed}) => [styles.dangerButton, busy ? styles.disabled : undefined, pressed ? styles.pressed : undefined]}>
                  <Text style={styles.dangerButtonText}>Disable System Auth</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : status ? (
          <View style={styles.noticeBlock}>
            <Text style={styles.noticeTitle}>No protected local signer</Text>
            <Text style={styles.noticeText}>System Auth applies to protected software signers. A watch-only wallet has nothing to register.</Text>
          </View>
        ) : null}

        {busy ? <ActivityIndicator color="#00CA8A" style={styles.inlineLoader} /> : null}
        {notice ? <Text style={styles.success}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.sectionLabel}>APP LOCK</Text>
        <View style={styles.noticeBlock}>
          <Text style={styles.noticeTitle}>Not enabled yet</Text>
          <Text style={styles.noticeText}>
            The current Fresnica adapter has no safe verification-only passphrase API or generic System Auth challenge for app-session unlock. Mobile will not emulate this with Reveal, dummy signing, or a second JavaScript verifier.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusRow({label, value}: Readonly<{label: string; value: string}>) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to update security settings.';
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  headerTitle: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  content: {paddingBottom: 36},
  sectionLabel: {paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8, fontSize: 10, lineHeight: 13, color: '#ACB1C1', fontWeight: '800'},
  rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  statusRow: {minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  switchRow: {minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  flex: {flex: 1},
  rowLabel: {fontSize: 13, lineHeight: 17, color: '#000000', fontWeight: '600'},
  rowDescription: {fontSize: 10, lineHeight: 14, color: '#ACB1C1', marginTop: 3},
  rowValue: {flex: 1, fontSize: 12, lineHeight: 16, color: '#606885', fontWeight: '600', textAlign: 'right'},
  loadingBlock: {minHeight: 120, alignItems: 'center', justifyContent: 'center'},
  passphraseBlock: {paddingHorizontal: 18, gap: 10},
  passphraseHint: {fontSize: 10, lineHeight: 15, color: '#606885'},
  input: {minHeight: 52, borderRadius: 10, backgroundColor: '#F3F6FA', paddingHorizontal: 14, color: '#000000', fontSize: 14},
  primaryButton: {minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00CA8A'},
  primaryButtonText: {fontSize: 14, color: '#FFFFFF', fontWeight: '800'},
  dangerButton: {minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 91, 91, 0.1)'},
  dangerButtonText: {fontSize: 13, color: '#FF5B5B', fontWeight: '800'},
  noticeBlock: {marginHorizontal: 18, borderRadius: 11, backgroundColor: '#F3F6FA', padding: 14, gap: 5},
  noticeTitle: {fontSize: 12, lineHeight: 16, color: '#181D41', fontWeight: '800'},
  noticeText: {fontSize: 10, lineHeight: 15, color: '#606885'},
  inlineLoader: {marginTop: 14},
  success: {marginHorizontal: 18, marginTop: 14, borderRadius: 9, padding: 12, backgroundColor: 'rgba(0, 202, 138, 0.09)', color: '#00B279', fontSize: 11, lineHeight: 16},
  error: {marginHorizontal: 18, marginTop: 14, borderRadius: 9, padding: 12, backgroundColor: 'rgba(255, 91, 91, 0.09)', color: '#FF5B5B', fontSize: 11, lineHeight: 16},
  disabled: {opacity: 0.45},
  pressed: {opacity: 0.68},
});
