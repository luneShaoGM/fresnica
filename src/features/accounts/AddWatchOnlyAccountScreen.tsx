import React, {useState} from 'react';
import {ActivityIndicator, StyleSheet, Text} from 'react-native';

import type {ProvisionAccountDependencies} from '../../capabilities/account/provisionAccount';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Field} from '../../ui/Field';
import {Screen} from '../../ui/Screen';
import {palette, typography} from '../../ui/theme';
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
    <Screen
      eyebrow="Add account"
      title="Watch-only account"
      description="Track another Stellar address without adding local signing authority."
      keyboardShouldPersistTaps="handled"
      leading={<Button label="Cancel" variant="ghost" onPress={onCancel} />}>
      <Card description="Adding another protected software signer is temporarily disabled until Fresnica can verify the wallet's existing app passphrase through a framework-safe native operation. Watch-only accounts are unaffected." />
      <Field
        label="Account label"
        value={label}
        onChangeText={setLabel}
        placeholder="Additional account"
      />
      <Field
        label="Stellar address"
        autoCapitalize="characters"
        value={address}
        onChangeText={setAddress}
        placeholder="G... or C..."
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Add account" disabled={busy} onPress={() => void submit()} />
      {busy ? <ActivityIndicator /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.caption,
    color: palette.danger,
    fontWeight: '600',
  },
});
