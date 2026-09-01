import React, {useState} from 'react';
import {StyleSheet, Text, TextInput} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  revealAccountRecoveryMaterial,
  type RecoveryExportDependencies,
} from '../../capabilities/signer/revealRecoveryMaterial';
import type {RevealedSigningMaterial} from '../../platform/fresnica/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, radius, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  account: AccountRecord;
  dependencies: RecoveryExportDependencies;
  onDone: () => void;
}>;

export function RecoveryExportScreen({account, dependencies, onDone}: Props) {
  const [appPassphrase, setAppPassphrase] = useState('');
  const [material, setMaterial] = useState<RevealedSigningMaterial>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function reveal() {
    const freshPassphrase = appPassphrase;
    setAppPassphrase('');
    setError(undefined);
    setBusy(true);
    try {
      const revealed = await revealAccountRecoveryMaterial(
        dependencies,
        account.id,
        freshPassphrase,
      );
      setMaterial(revealed);
    } catch (caught) {
      setMaterial(undefined);
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  function hide() {
    setMaterial(undefined);
    setError(undefined);
  }

  function done() {
    setAppPassphrase('');
    setMaterial(undefined);
    setError(undefined);
    onDone();
  }

  return (
    <Screen eyebrow="Account security" title="Export recovery material">
      <Card
        title={account.label || 'Stellar account'}
        description="Recovery material is revealed only for this explicit screen and is not saved to navigation or wallet persistence." />

      {material ? (
        <>
          <Card
            title={material.kind === 'mnemonic' ? 'Recovery phrase' : 'Stellar secret'}
            description="Keep this material offline. Anyone who has it can control the signer.">
            <Text selectable style={styles.secretText}>
              {material.kind === 'mnemonic' ? material.mnemonic : material.secret}
            </Text>
            {material.kind === 'mnemonic' ? (
              <>
                {material.mnemonicPassphrase !== undefined ? (
                  <Metadata label="Mnemonic passphrase" value={material.mnemonicPassphrase} sensitive />
                ) : null}
                {material.language !== undefined ? (
                  <Metadata label="Language" value={material.language} />
                ) : null}
                {material.index !== undefined ? (
                  <Metadata label="Derivation index" value={String(material.index)} />
                ) : null}
              </>
            ) : null}
          </Card>
          <Button label="Hide recovery material" variant="secondary" onPress={hide} />
          <Button label="Done" onPress={done} />
        </>
      ) : (
        <>
          <Card
            title="Fresh app passphrase required"
            description="Biometric/System Auth is intentionally not used for recovery export. Enter the app passphrase to ask Fresnica Core to reveal the protected signer material." />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            secureTextEntry
            value={appPassphrase}
            onChangeText={setAppPassphrase}
            placeholder="Enter your app passphrase"
            placeholderTextColor={palette.textMuted}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={busy ? 'Revealing…' : 'Reveal recovery material'}
            disabled={busy || appPassphrase.length === 0}
            onPress={() => void reveal()}
          />
          <Button label="Cancel" variant="ghost" onPress={done} />
        </>
      )}
    </Screen>
  );
}

function Metadata({
  label,
  value,
  sensitive = false,
}: Readonly<{label: string; value: string; sensitive?: boolean}>) {
  return (
    <Text selectable={sensitive} style={styles.metadata}>
      {label}: {value.length === 0 ? '(none)' : value}
    </Text>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to reveal recovery material.';
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: palette.text,
    backgroundColor: palette.surface,
    ...typography.body,
  },
  secretText: {
    ...typography.body,
    color: palette.text,
    lineHeight: 26,
  },
  metadata: {
    ...typography.caption,
    color: palette.textMuted,
  },
  error: {
    ...typography.caption,
    color: palette.text,
    fontWeight: '600',
  },
});
