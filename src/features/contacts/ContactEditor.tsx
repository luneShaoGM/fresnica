import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { saveContact, type ContactDraft } from '@capabilities/contacts/contacts';
import type { StellarPaymentMemo } from '@capabilities/stellar/types';
import { Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { contactError, contactShareUri, type ContactBook } from './contactBook';
import { createStyles } from './styles';

type Props = Readonly<{
  book: ContactBook;
  initial?: ContactDraft;
  id?: string;
  onClose(): void;
  isCurrent?: () => boolean;
}>;
export function ContactEditor({ book, initial, id, onClose, isCurrent = () => true }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [memoType, setMemoType] = useState<'none' | StellarPaymentMemo['type']>(initial?.memo?.type ?? 'none');
  const [memoValue, setMemoValue] = useState(initial?.memo?.value ?? '');
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = useRef(true);
  const deleting = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const close = () => {
    live.current = false;
    onClose();
  };
  const save = () => {
    if (!live.current || !isCurrent() || deleting.current) return;
    try {
      if (id && !book.store.list(book.network.id).some(row => row.id === id)) throw new Error('contact-not-found');
      saveContact(
        book,
        book.network.id,
        { name, address, ...(memoType === 'none' ? {} : { memo: { type: memoType, value: memoValue } }) },
        id,
      );
      close();
    } catch (caught) {
      setError(contactError(caught, t));
    }
  };
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        {t(id ? 'contacts.edit' : 'contacts.add')}
      </Text>
      <Text style={styles.hint}>{t('contacts.local')}</Text>
      <Field
        label={t('contacts.name')}
        accessibilityLabel={t('contacts.name')}
        maxLength={30}
        value={name}
        onChangeText={setName}
      />
      <Field
        label={t('contacts.address')}
        accessibilityLabel={t('contacts.address')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={address}
        onChangeText={setAddress}
      />
      <Text style={styles.hint}>{t('contacts.classicOnly')}</Text>
      <Text style={styles.title}>{t('contacts.memo')}</Text>
      <View style={styles.types}>
        {(['none', 'text', 'id', 'hash'] as const).map(type => (
          <NativeButton
            key={type}
            label={t(`send.memo.type.${type}`)}
            variant={memoType === type ? 'primary' : 'quiet'}
            size="sm"
            onPress={() => {
              if (type === memoType) return;
              setMemoType(type);
              setMemoValue('');
              setError(undefined);
            }}
          />
        ))}
      </View>
      {memoType !== 'none' ? (
        <Field
          label={t(`send.memo.input.${memoType}`)}
          accessibilityLabel={t(`send.memo.input.${memoType}`)}
          hint={t(`send.memo.hint.${memoType}`)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={memoType === 'id' ? 'number-pad' : 'default'}
          value={memoValue}
          onChangeText={setMemoValue}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <NativeButton label={t('contacts.save')} onPress={save} variant="primary" />
        <NativeButton label={t('common.cancel')} onPress={close} variant="quiet" />
        {id ? (
          <NativeButton
            label={t('contacts.share')}
            variant="quiet"
            onPress={async () => {
              if (!live.current || !isCurrent()) return;
              try {
                const contact = book.store.list(book.network.id).find(row => row.id === id);
                if (!contact) throw new Error('contact-not-found');
                await book.output.shareRequestUri(contactShareUri(book, contact));
              } catch (caught) {
                if (live.current && isCurrent()) setError(contactError(caught, t));
              }
            }}
          />
        ) : null}
        {id && !confirmDelete ? (
          <NativeButton
            label={t('contacts.delete')}
            onPress={() => {
              if (live.current) {
                deleting.current = true;
                setConfirmDelete(true);
              }
            }}
            variant="quiet"
          />
        ) : null}
      </View>
      {confirmDelete ? (
        <View style={styles.confirmation} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.title}>
            {t('contacts.deleteConfirm')}
          </Text>
          <Text style={styles.hint}>{t('contacts.deleteDetail')}</Text>
          <NativeButton
            label={t('contacts.keep')}
            variant="quiet"
            onPress={() => {
              deleting.current = false;
              setConfirmDelete(false);
            }}
          />
          <NativeButton
            label={t('contacts.delete')}
            variant="primary"
            onPress={() => {
              if (!live.current || !isCurrent() || !deleting.current || !id) return;
              try {
                book.store.remove(book.network.id, id);
                close();
              } catch (caught) {
                setError(contactError(caught, t));
              }
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
