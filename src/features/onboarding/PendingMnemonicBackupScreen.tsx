import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {ProvisionAccountDependencies} from '../../capabilities/account/provisionAccount';
import {palette} from '../../ui/theme';
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.brand}>fresnica</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.securityMark}>
            <Text style={styles.securityGlyph}>⌁</Text>
          </View>
          <Text style={styles.title}>Finish recovery phrase backup</Text>
          <Text style={styles.body}>
            {backup
              ? 'Write these words down in order and store them offline. They are shown only for this explicit backup step.'
              : 'Fresnica did not store the plaintext phrase. Enter your app passphrase to reveal it again through Fresnica Core and finish the interrupted backup.'}
          </Text>
        </View>

        {backup ? (
          <RecoveryPhrase mnemonic={backup.mnemonic} />
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.label}>App passphrase</Text>
            <TextInput
              autoCapitalize="none"
              secureTextEntry
              value={appPassphrase}
              onChangeText={setAppPassphrase}
              placeholder="Enter your app passphrase"
              placeholderTextColor="#ACB1C1"
              selectionColor={palette.accent}
              style={styles.input}
            />
            <View style={styles.infoRow}>
              <Text style={styles.infoGlyph}>i</Text>
              <Text style={styles.infoText}>
                The passphrase is used only to recover the pending backup through Fresnica Core.
              </Text>
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={backup ? false : busy || appPassphrase.length === 0}
          onPress={backup ? confirm : () => void recover()}
          style={({pressed}) => [
            styles.primaryButton,
            !backup && (busy || appPassphrase.length === 0) ? styles.disabled : undefined,
            pressed ? styles.primaryButtonPressed : undefined,
          ]}>
          {busy && !backup ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {backup ? 'I have backed it up' : 'Reveal recovery phrase'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function RecoveryPhrase({mnemonic}: Readonly<{mnemonic: string}>) {
  return (
    <View style={styles.recoveryBox}>
      {mnemonic.trim().split(/\s+/u).map((word, index) => (
        <View key={`${index}-${word}`} style={styles.recoveryWord}>
          <Text style={styles.recoveryNumber}>{index + 1}</Text>
          <Text selectable style={styles.recoveryText}>{word}</Text>
        </View>
      ))}
    </View>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to continue.';
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: palette.background},
  header: {height: 60, justifyContent: 'center', paddingHorizontal: 20},
  brand: {color: palette.text, fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6},
  scroll: {flexGrow: 1, paddingBottom: 24},
  hero: {alignItems: 'center', paddingHorizontal: 26, paddingTop: 28, paddingBottom: 24},
  securityMark: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,202,138,0.13)',
    marginBottom: 18,
  },
  securityGlyph: {color: palette.accentPressed, fontSize: 34, lineHeight: 38, fontWeight: '800'},
  title: {color: palette.text, fontSize: 25, lineHeight: 31, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5},
  body: {color: palette.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, maxWidth: 350},
  formCard: {marginHorizontal: 20, padding: 16, borderRadius: 12, backgroundColor: palette.surfaceMuted, gap: 8},
  label: {color: palette.text, fontSize: 13, lineHeight: 17, fontWeight: '700'},
  input: {minHeight: 48, borderRadius: 9, backgroundColor: '#FFFFFF', color: palette.text, fontSize: 15, paddingHorizontal: 13},
  infoRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4},
  infoGlyph: {
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    backgroundColor: '#181D41',
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '800',
  },
  infoText: {flex: 1, color: palette.textMuted, fontSize: 11, lineHeight: 17},
  recoveryBox: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: palette.surfaceMuted,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recoveryWord: {
    width: '47%',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
  },
  recoveryNumber: {width: 22, color: '#ACB1C1', fontSize: 11, lineHeight: 15},
  recoveryText: {flex: 1, color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '700'},
  errorBox: {marginHorizontal: 20, marginTop: 14, borderRadius: 9, backgroundColor: 'rgba(255,91,91,0.09)', padding: 11},
  error: {color: '#C43C3C', fontSize: 12, lineHeight: 18, fontWeight: '600'},
  footer: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border},
  primaryButton: {minHeight: 50, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent, paddingHorizontal: 18},
  primaryButtonPressed: {backgroundColor: palette.accentPressed},
  primaryButtonText: {color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '800'},
  disabled: {opacity: 0.45},
});
