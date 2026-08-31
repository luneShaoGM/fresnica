import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import type {ProvisionAccountDependencies} from '../../capabilities/account/provisionAccount';
import {runWatchOnlyOnboarding} from '../onboarding/runOnboardingProvisioning';

type Props = Readonly<{
  dependencies: ProvisionAccountDependencies;
  onComplete: () => void;
  onCancel: () => void;
}>;

export function AddWatchOnlyAccountScreen({dependencies, onComplete, onCancel}: Props) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await runWatchOnlyOnboarding(dependencies, {address, label});
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={onCancel}>
        <Text style={styles.back}>Cancel</Text>
      </Pressable>
      <Text style={styles.eyebrow}>Add account</Text>
      <Text style={styles.title}>Watch-only account</Text>
      <Text style={styles.body}>
        Additional protected software signers are temporarily disabled until the
        Fresnica RN boundary can verify the wallet's existing app passphrase
        without revealing recovery material. Watch-only accounts remain safe to
        add now.
      </Text>
      <Text style={styles.label}>Account label</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="Additional account"
        style={styles.input}
      />
      <Text style={styles.label}>Stellar address</Text>
      <TextInput
        autoCapitalize="characters"
        value={address}
        onChangeText={setAddress}
        placeholder="G... or C..."
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void submit()}
        style={[styles.button, busy ? styles.disabled : undefined]}>
        <Text style={styles.buttonText}>Add account</Text>
      </Pressable>
      {busy ? <ActivityIndicator /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flexGrow: 1, padding: 24, paddingTop: 64, gap: 16},
  back: {fontSize: 16, fontWeight: '600'},
  eyebrow: {fontSize: 13, fontWeight: '600', textTransform: 'uppercase'},
  title: {fontSize: 30, fontWeight: '700'},
  body: {fontSize: 16, lineHeight: 24},
  label: {fontSize: 14, fontWeight: '600'},
  input: {borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16},
  error: {fontSize: 14, fontWeight: '600'},
  button: {borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center'},
  buttonText: {fontSize: 16, fontWeight: '700'},
  disabled: {opacity: 0.5},
});
