import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {BalanceAsset, BalanceLine} from '../../capabilities/balance/types';
import {sendAssetKey} from './sendProductFlow';

type Props = Readonly<{
  accountLabel: string;
  balances: readonly BalanceLine[];
  selectedAsset: BalanceAsset;
  destination: string;
  amount: string;
  memo: string;
  building: boolean;
  error?: string;
  onSelectAsset: (asset: BalanceAsset) => void;
  onChangeDestination: (value: string) => void;
  onChangeAmount: (value: string) => void;
  onChangeMemo: (value: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}>;

export function SendFormScreen({
  accountLabel,
  balances,
  selectedAsset,
  destination,
  amount,
  memo,
  building,
  error,
  onSelectAsset,
  onChangeDestination,
  onChangeAmount,
  onChangeMemo,
  onContinue,
  onCancel,
}: Props) {
  const selectedBalance = balances.find(
    line => sendAssetKey(line.asset) === sendAssetKey(selectedAsset),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Cancel send" onPress={onCancel} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Send</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text numberOfLines={1} style={styles.fromLabel}>From {accountLabel}</Text>

        <Text style={styles.sectionLabel}>ASSET</Text>
        <ScrollView
          contentContainerStyle={styles.assetList}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}>
          {balances.map(line => {
            const selected = sendAssetKey(line.asset) === sendAssetKey(selectedAsset);
            return (
              <Pressable
                key={sendAssetKey(line.asset)}
                onPress={() => onSelectAsset(line.asset)}
                disabled={building}
                style={({pressed}) => [
                  styles.assetCard,
                  selected ? styles.assetCardSelected : undefined,
                  pressed ? styles.pressed : undefined,
                ]}>
                <View style={[styles.assetIcon, selected ? styles.assetIconSelected : undefined]}>
                  <Text style={[styles.assetIconText, selected ? styles.assetIconTextSelected : undefined]}>
                    {line.asset.code.slice(0, 1)}
                  </Text>
                </View>
                <Text style={styles.assetCode}>{line.asset.code}</Text>
                <Text numberOfLines={1} style={styles.assetBalance}>{line.balance}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.balanceLine}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Text style={styles.balanceValue}>
            {selectedBalance?.balance ?? '—'} {selectedAsset.code}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>RECIPIENT</Text>
        <View style={styles.fieldBox}>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!building}
            onChangeText={onChangeDestination}
            placeholder="Stellar G... address"
            placeholderTextColor="#ACB1C1"
            style={styles.fieldInput}
            value={destination}
          />
          <View style={styles.fieldAction}><Text style={styles.fieldActionGlyph}>⌕</Text></View>
        </View>
        <Text style={styles.fieldHint}>Classic Stellar G... destinations are supported.</Text>

        <Text style={styles.sectionLabel}>AMOUNT</Text>
        <View style={styles.amountBox}>
          <TextInput
            editable={!building}
            keyboardType="decimal-pad"
            onChangeText={onChangeAmount}
            placeholder="0"
            placeholderTextColor="#ACB1C1"
            style={styles.amountInput}
            value={amount}
          />
          <Text style={styles.amountAsset}>{selectedAsset.code}</Text>
        </View>
        <Text style={styles.fieldHint}>Up to 7 decimal places.</Text>

        <Text style={styles.sectionLabel}>MEMO</Text>
        <View style={styles.fieldBox}>
          <TextInput
            autoCorrect={false}
            editable={!building}
            onChangeText={onChangeMemo}
            placeholder="Optional text memo"
            placeholderTextColor="#ACB1C1"
            style={styles.fieldInput}
            value={memo}
          />
        </View>
        <Text style={styles.fieldHint}>Maximum 28 UTF-8 bytes. Text is preserved exactly.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          disabled={building}
          onPress={onContinue}
          style={({pressed}) => [
            styles.reviewButton,
            building ? styles.reviewButtonDisabled : undefined,
            pressed ? styles.pressed : undefined,
          ]}>
          <Text style={styles.reviewButtonText}>{building ? 'Preparing…' : 'Review payment'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  headerTitle: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  content: {paddingBottom: 28},
  fromLabel: {paddingHorizontal: 18, paddingTop: 14, fontSize: 11, lineHeight: 15, color: '#ACB1C1'},
  sectionLabel: {paddingHorizontal: 18, paddingTop: 21, paddingBottom: 8, fontSize: 10, lineHeight: 13, color: '#ACB1C1', fontWeight: '800'},
  assetList: {paddingHorizontal: 18, gap: 9},
  assetCard: {width: 94, minHeight: 100, borderWidth: 1, borderColor: '#E7EAF0', borderRadius: 12, padding: 11, backgroundColor: '#FFFFFF', gap: 5},
  assetCardSelected: {borderColor: '#00CA8A', backgroundColor: 'rgba(0, 202, 138, 0.05)'},
  assetIcon: {width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA'},
  assetIconSelected: {backgroundColor: '#00CA8A'},
  assetIconText: {fontSize: 14, color: '#181D41', fontWeight: '800'},
  assetIconTextSelected: {color: '#FFFFFF'},
  assetCode: {fontSize: 13, lineHeight: 16, color: '#000000', fontWeight: '800'},
  assetBalance: {fontSize: 10, lineHeight: 13, color: '#606885'},
  balanceLine: {minHeight: 42, marginHorizontal: 18, marginTop: 10, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#F3F6FA', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  balanceLabel: {fontSize: 11, color: '#606885'},
  balanceValue: {fontSize: 11, color: '#181D41', fontWeight: '700'},
  fieldBox: {minHeight: 52, marginHorizontal: 18, borderRadius: 10, backgroundColor: '#F3F6FA', flexDirection: 'row', alignItems: 'center', paddingLeft: 14},
  fieldInput: {flex: 1, minHeight: 52, color: '#000000', fontSize: 14, paddingVertical: 0},
  fieldAction: {width: 45, height: 52, alignItems: 'center', justifyContent: 'center'},
  fieldActionGlyph: {fontSize: 18, color: '#606885'},
  fieldHint: {paddingHorizontal: 22, paddingTop: 5, fontSize: 9, lineHeight: 13, color: '#ACB1C1'},
  amountBox: {minHeight: 70, marginHorizontal: 18, borderRadius: 10, backgroundColor: '#F3F6FA', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10},
  amountInput: {flex: 1, minHeight: 70, color: '#000000', fontSize: 30, lineHeight: 36, fontWeight: '600', paddingVertical: 0},
  amountAsset: {fontSize: 15, color: '#181D41', fontWeight: '800'},
  error: {marginHorizontal: 18, marginTop: 16, borderRadius: 9, padding: 12, backgroundColor: 'rgba(255, 91, 91, 0.09)', color: '#FF5B5B', fontSize: 11, lineHeight: 16},
  bottomBar: {paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0', backgroundColor: '#FFFFFF'},
  reviewButton: {minHeight: 54, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00CA8A'},
  reviewButtonDisabled: {opacity: 0.5},
  reviewButtonText: {fontSize: 15, color: '#FFFFFF', fontWeight: '800'},
  pressed: {opacity: 0.68},
});
