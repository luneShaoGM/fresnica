import React from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';

type Props = Readonly<{
  account: AccountRecord;
  onSend: () => void;
  onManageAssets: () => void;
  onBack: () => void;
}>;

export function AccountDetailsScreen({account, onSend, onManageAssets, onBack}: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identityBlock}>
          <View style={styles.accountIcon}><Text style={styles.accountIconText}>{(account.label || 'S').slice(0, 1).toUpperCase()}</Text></View>
          <Text style={styles.accountLabel}>{account.label || 'Stellar account'}</Text>
          <Text selectable style={styles.address}>{account.address}</Text>
        </View>

        <View style={styles.section}>
          <DetailRow label="Identity" value={account.identityKind} />
          <DetailRow label="Network" value={account.networkId} />
          <DetailRow label="Visibility" value={account.hidden ? 'Hidden' : 'Visible'} />
        </View>

        <Text style={styles.sectionLabel}>Wallet actions</Text>
        <View style={styles.actionRow}>
          <Pressable onPress={onSend} style={({pressed}) => [styles.primaryAction, pressed ? styles.pressed : undefined]}>
            <Text style={styles.primaryActionText}>Send</Text>
          </Pressable>
          <Pressable onPress={onManageAssets} style={({pressed}) => [styles.secondaryAction, pressed ? styles.pressed : undefined]}>
            <Text style={styles.secondaryActionText}>Manage assets</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Signer access is derived from Fresnica Account-Signer relationships. Ledger balances and trustlines remain network state and are not stored as account identity truth.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({label, value}: Readonly<{label: string; value: string}>) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={2} selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
  },
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  title: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  content: {paddingBottom: 34},
  identityBlock: {alignItems: 'center', paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, gap: 8},
  accountIcon: {width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181D41'},
  accountIconText: {fontSize: 27, color: '#FFFFFF', fontWeight: '800'},
  accountLabel: {fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#000000'},
  address: {fontSize: 10, lineHeight: 15, color: '#606885', textAlign: 'center', fontVariant: ['tabular-nums']},
  section: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  detailRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
    gap: 20,
  },
  detailLabel: {fontSize: 13, lineHeight: 17, color: '#000000', fontWeight: '600'},
  detailValue: {flex: 1, fontSize: 12, lineHeight: 16, color: '#606885', textAlign: 'right'},
  sectionLabel: {paddingHorizontal: 18, paddingTop: 24, paddingBottom: 8, fontSize: 11, color: '#ACB1C1', fontWeight: '700'},
  actionRow: {paddingHorizontal: 18, gap: 10},
  primaryAction: {minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00CA8A'},
  primaryActionText: {fontSize: 15, color: '#FFFFFF', fontWeight: '800'},
  secondaryAction: {minHeight: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA'},
  secondaryActionText: {fontSize: 15, color: '#181D41', fontWeight: '800'},
  note: {paddingHorizontal: 22, paddingTop: 18, fontSize: 10, lineHeight: 15, color: '#ACB1C1', textAlign: 'center'},
  pressed: {opacity: 0.68},
});
