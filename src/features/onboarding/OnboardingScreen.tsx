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
  type RecoveredMnemonicBackup,
} from './onboardingBootstrap';
import type {OnboardingMethod} from './onboardingState';
import {
  runGeneratedMnemonicOnboarding,
  runMnemonicImportOnboarding,
  runSecretImportOnboarding,
  runWatchOnlyOnboarding,
} from './runOnboardingProvisioning';

type Props = Readonly<{
  dependencies: ProvisionAccountDependencies;
  onComplete: () => void;
  onCancel?: () => void;
}>;

type GeneratedBackupState = RecoveredMnemonicBackup & {
  signerId: string;
};

export function OnboardingScreen({dependencies, onComplete, onCancel}: Props) {
  const [method, setMethod] = useState<OnboardingMethod>();
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [secret, setSecret] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [appPassphrase, setAppPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [generatedBackup, setGeneratedBackup] =
    useState<GeneratedBackupState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function chooseMethod(nextMethod: OnboardingMethod) {
    clearSensitiveInputs();
    setGeneratedBackup(undefined);
    setError(undefined);
    setMethod(nextMethod);
  }

  function returnToMethodSelection() {
    clearSensitiveInputs();
    setAddress('');
    setError(undefined);
    setMethod(undefined);
  }

  function clearSensitiveInputs() {
    setSecret('');
    setMnemonic('');
    setAppPassphrase('');
    setConfirmPassphrase('');
  }

  function validatePassphrase() {
    if (Array.from(appPassphrase).length < 15) {
      throw new Error('App passphrase must contain at least 15 characters.');
    }
    if (appPassphrase !== confirmPassphrase) {
      throw new Error('App passphrase confirmation does not match.');
    }
  }

  async function submit() {
    if (!method) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      if (method === 'watch-only') {
        await runWatchOnlyOnboarding(dependencies, {address, label});
        onComplete();
        return;
      }

      validatePassphrase();

      if (method === 'import-secret') {
        await runSecretImportOnboarding(dependencies, {
          secret,
          appPassphrase,
          label,
        });
        clearSensitiveInputs();
        onComplete();
        return;
      }

      if (method === 'import-mnemonic') {
        await runMnemonicImportOnboarding(dependencies, {
          mnemonic,
          mnemonicPassphrase: '',
          index: 0,
          appPassphrase,
          label,
        });
        clearSensitiveInputs();
        onComplete();
        return;
      }

      const result = await runGeneratedMnemonicOnboarding(dependencies, {
        language: 'english',
        strength: 128,
        mnemonicPassphrase: '',
        index: 0,
        appPassphrase,
        label,
      });

      setGeneratedBackup({
        ...result.backup,
        signerId: result.account.signer.id,
      });
      clearSensitiveInputs();
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  function confirmGeneratedBackup() {
    if (!generatedBackup) {
      return;
    }

    try {
      confirmMnemonicBackup(dependencies, generatedBackup.signerId);
      setGeneratedBackup(undefined);
      onComplete();
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  if (generatedBackup) {
    return (
      <Screen>
        <Text style={styles.title}>Back up your recovery phrase</Text>
        <Text style={styles.body}>
          Write these words down in order and store them offline. Fresnica does
          not persist this plaintext phrase.
        </Text>
        <View style={styles.recoveryBox}>
          <Text selectable style={styles.recoveryText}>
            {generatedBackup.mnemonic}
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="I have backed it up"
          onPress={confirmGeneratedBackup}
        />
      </Screen>
    );
  }

  if (!method) {
    return (
      <Screen>
        {onCancel ? (
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <Text style={styles.back}>Cancel</Text>
          </Pressable>
        ) : null}
        <Text style={styles.eyebrow}>Stellar Testnet</Text>
        <Text style={styles.title}>Set up Fresnica</Text>
        <Text style={styles.body}>
          Create a new wallet, import an existing signer, or add a watch-only
          account.
        </Text>
        <ChoiceButton
          title="Create new wallet"
          subtitle="Generate a new recovery phrase with Fresnica Core"
          onPress={() => chooseMethod('generate-mnemonic')}
        />
        <ChoiceButton
          title="Import recovery phrase"
          subtitle="Protect an existing mnemonic locally"
          onPress={() => chooseMethod('import-mnemonic')}
        />
        <ChoiceButton
          title="Import Stellar secret"
          subtitle="Protect an existing S... secret locally"
          onPress={() => chooseMethod('import-secret')}
        />
        <ChoiceButton
          title="Watch-only account"
          subtitle="Track an address without adding a local signer"
          onPress={() => chooseMethod('watch-only')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={returnToMethodSelection}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>{methodTitle(method)}</Text>
      <Field
        label="Account label"
        value={label}
        onChangeText={setLabel}
        placeholder="Primary account"
      />

      {method === 'watch-only' ? (
        <Field
          label="Stellar address"
          value={address}
          onChangeText={setAddress}
          placeholder="G... or C..."
          autoCapitalize="characters"
        />
      ) : null}

      {method === 'import-secret' ? (
        <Field
          label="Stellar secret"
          value={secret}
          onChangeText={setSecret}
          placeholder="S..."
          secureTextEntry
          autoCapitalize="characters"
        />
      ) : null}

      {method === 'import-mnemonic' ? (
        <Field
          label="Recovery phrase"
          value={mnemonic}
          onChangeText={setMnemonic}
          placeholder="Enter words in order"
          multiline
          autoCapitalize="none"
        />
      ) : null}

      {method !== 'watch-only' ? (
        <>
          <Field
            label="App passphrase"
            value={appPassphrase}
            onChangeText={setAppPassphrase}
            placeholder="At least 15 characters"
            secureTextEntry
            autoCapitalize="none"
          />
          <Field
            label="Confirm app passphrase"
            value={confirmPassphrase}
            onChangeText={setConfirmPassphrase}
            placeholder="Enter it again"
            secureTextEntry
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            This passphrase protects local signing material. It is not stored in
            Realm.
          </Text>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={submitLabel(method)}
        onPress={() => void submit()}
        disabled={busy}
      />
      {busy ? <ActivityIndicator /> : null}
    </Screen>
  );
}

function Screen({children}: React.PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & {label: string}) {
  const {label, multiline, ...inputProps} = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        style={[styles.input, multiline ? styles.multiline : undefined]}
      />
    </View>
  );
}

function ChoiceButton(props: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={styles.choice}>
      <Text style={styles.choiceTitle}>{props.title}</Text>
      <Text style={styles.choiceSubtitle}>{props.subtitle}</Text>
    </Pressable>
  );
}

function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
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

function methodTitle(method: OnboardingMethod): string {
  switch (method) {
    case 'generate-mnemonic':
      return 'Create new wallet';
    case 'import-mnemonic':
      return 'Import recovery phrase';
    case 'import-secret':
      return 'Import Stellar secret';
    case 'watch-only':
      return 'Add watch-only account';
  }
}

function submitLabel(method: OnboardingMethod): string {
  return method === 'watch-only' ? 'Add account' : 'Continue';
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
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  back: {
    fontSize: 16,
    fontWeight: '600',
  },
  field: {
    gap: 8,
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
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
  },
  choice: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 5,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  choiceSubtitle: {
    fontSize: 14,
    lineHeight: 20,
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
  recoveryBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  recoveryText: {
    fontSize: 18,
    lineHeight: 28,
  },
});
