import React, { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { CopyAddressButton } from '@features/accounts/CopyAddressButton';
import { BottomSheet } from '@ui/components/BottomSheet';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../locale';
import { createReceiveSheetStyles } from './receiveSheetStyles';

type Props = Readonly<{
  address: string;
  networkId: string;
  copyPublicText: (text: string) => Promise<void>;
  onClose: () => void;
  onCreateRequestLink: () => void;
}>;

export function ReceiveSheet({ address, networkId, copyPublicText, onClose, onCreateRequestLink }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createReceiveSheetStyles);
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return false;
    closing.current = true;
    onClose();
    return true;
  };
  const networkLabel =
    networkId === 'stellar-mainnet' || networkId === 'stellar-testnet'
      ? t(`networkManage.name.${networkId}`)
      : networkId;

  return (
    <BottomSheet closeLabel={t('common.close')} onClose={close} visible>
      <View style={styles.layout}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('receive.title')}
          </Text>
          <Text style={styles.network}>{networkLabel}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.addressCard}>
            <Text style={styles.addressLabel}>{t('request.address')}</Text>
            <CopyAddressButton
              address={address}
              addressStyle={styles.address}
              numberOfLines={0}
              copyPublicText={async text => {
                if (closing.current) throw new Error('receive-sheet-closed');
                await copyPublicText(text);
              }}
            />
          </View>
          <View
            accessible
            accessibilityLabel={t('receive.qr.accessibility', { address })}
            accessibilityRole="image"
            style={styles.qr}
          >
            <QRCode value={address} size={192} quietZone={28} />
          </View>
        </ScrollView>
        <NativeButton
          label={t('receive.createRequestLink')}
          onPress={() => {
            if (close()) onCreateRequestLink();
          }}
        />
      </View>
    </BottomSheet>
  );
}
