import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {ProvisionAccountDependencies} from '../../capabilities/account/provisionAccount';
import {
  confirmMnemonicBackup,
  recoverPendingMnemonicBackup,
  type RecoveredMnemonicBackup,
} from './onboardingBootstrap';

type Props = Readonly<{
  dependencies: ProvisionAccountDependencies;
  signerId: string;
  onComplete: () => void;
}>;

export function PendingMnemonicBackupScreen({
  dependencies,
  signerId,
  onComplete,
}: Props) {
  const [appPassphrase, setAppPassphrase] = useState('');
  const [backup, setBackup] = useState<RecoveredMnemonicBackup>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function recover() {
    setBusy(true);
    setError(undefined);
    try {
      const recovered = await recoverPendingMnemonicBackup(
        dependencies,
        signerId,
        appPassphrase,
      );
      setAppPassphrase('');
      setBackup(recovered);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    try {
      confirmMnemonicBackup(dependencies, signerId);
      setBackup(undefined);
      onComplete();
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Finish recovery phrase backup</Text>
      {backup ? (
        <>
          <Text style={styles.body}>
            Write these words down in order and store them offline. They are
            shown only for this explicit backup step.
          </Text>
          <View style={styles.recoveryBox}>
            <Text selectable style={styles.recoveryText}>
              {backup.mnemonic}
            </Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={confirm}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>I have backed it up</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Fresnica did not store the plaintext phrase. Enter your app
            passphrase to reveal it again through Fresnica Core and finish the
            interrupted backup.
          </Text>
          <Text style={styles.label}>App passphrase</Text>
          <TextInput
            autoCapitalize="none"
            secureTextEntry
            value={appPassphrase}
            onChangeText={setAppPassphrase}
            placeholder="Enter your app passphrase"
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || appPassphrase.length === 0}
            onPress={() => void recover()}
            style={[
              styles.primaryButton,
              busy || appPassphrase.length === 0 ? styles.disabled : undefined,
            ]}>
            <Text style={styles.primaryButtonText}>Reveal recovery phrase</Text>
          </Pressable>
          {busy ? <ActivityIndicator /> : null}
        </>
      )}
    </ScrollView>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to continue.';
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
  },
  recoveryBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  recoveryText: {
    fontSize: 18,
    lineHeight: 28,
  },
  primaryButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
