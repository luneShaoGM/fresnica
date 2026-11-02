import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { findContact } from '@capabilities/contacts/contacts';
import { AccountIdentityCard, BottomSheet } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { ContactEditor } from './ContactEditor';
import { contactError, contactShareUri, type ContactBook, type Recipient } from './contactBook';
import { createStyles } from './styles';
import { useContactList } from './useContactList';

type Props = Recipient & Readonly<{ book: ContactBook; label: string; active?: boolean; editable?: boolean }>;
export function ParticipantCard({ book, label, address, memo, active = true, editable = true }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const { contacts, failed } = useContactList(book);
  const contact = findContact(contacts, address, memo);
  const [sheet, setSheet] = useState<'menu' | 'editor'>();
  const [error, setError] = useState<string>();
  const current = useRef<typeof sheet>(undefined);
  const generation = useRef(0);
  const capturedGeneration = generation.current;
  const live = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const close = () => {
    generation.current += 1;
    current.current = undefined;
    setSheet(undefined);
    setError(undefined);
  };
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current += 1;
      current.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (!active) close();
  }, [active]);
  const available = () => live.current && activeRef.current && capturedGeneration === generation.current;
  const action = async (kind: 'copy' | 'share') => {
    if (!available() || current.current !== 'menu') return;
    setError(undefined);
    try {
      if (kind === 'copy') await book.copyPublicText(address);
      else await book.output.shareRequestUri(contactShareUri(book, { address, memo }));
    } catch (caught) {
      if (available() && current.current === 'menu') setError(contactError(caught, t));
    }
  };
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${contact?.name ?? address}`}
        onPress={() => {
          if (available() && !current.current) {
            current.current = 'menu';
            setSheet('menu');
          }
        }}
      >
        <AccountIdentityCard address={address} name={contact?.name ?? ''} label={label} />
      </Pressable>
      {active && sheet ? (
        <BottomSheet visible onClose={close} closeLabel={t('common.cancel')}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {sheet === 'editor' ? (
              <ContactEditor
                book={book}
                initial={contact ?? { name: '', address, memo }}
                id={contact?.id}
                onClose={close}
                isCurrent={() => available() && current.current === 'editor'}
              />
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.title}>
                  {contact?.name || label}
                </Text>
                <Text selectable style={styles.address}>
                  {address}
                </Text>
                {memo ? (
                  <Text selectable style={styles.address}>{`${t(`send.memo.type.${memo.type}`)}: ${memo.value}`}</Text>
                ) : null}
                <Text style={styles.hint}>{t('contacts.local')}</Text>
                <NativeButton label={t('contacts.copy')} variant="quiet" onPress={() => void action('copy')} />
                <NativeButton label={t('contacts.share')} variant="quiet" onPress={() => void action('share')} />
                {editable ? (
                  <NativeButton
                    label={t(contact ? 'contacts.edit' : 'contacts.add')}
                    variant="primary"
                    disabled={failed}
                    onPress={() => {
                      if (available() && current.current === 'menu') {
                        current.current = 'editor';
                        setSheet('editor');
                      }
                    }}
                  />
                ) : null}
                <NativeButton label={t('common.cancel')} variant="quiet" onPress={close} />
                {failed || error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error ?? t('contacts.error.storage')}
                  </Text>
                ) : null}
              </>
            )}
          </ScrollView>
        </BottomSheet>
      ) : null}
    </View>
  );
}
