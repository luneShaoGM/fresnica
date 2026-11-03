import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { AccountRecord } from '@capabilities/account/types';
import { searchContacts } from '@capabilities/contacts/contacts';
import { BottomSheet, Field, ListRow } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import {
  contactError,
  contactRecipient,
  contactSubtitle,
  destinationAccounts,
  type ContactBook,
  type Recipient,
} from './contactBook';
import { createStyles } from './styles';
import { useContactList } from './useContactList';

export function DestinationPicker({
  book,
  accounts,
  onSelect,
  onClose,
}: Readonly<{
  book: ContactBook;
  accounts: readonly AccountRecord[];
  onSelect(recipient: Recipient): void;
  onClose(): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>();
  const { contacts, failed } = useContactList(book);
  const matches = searchContacts(contacts, query);
  const own = destinationAccounts(accounts, book.network.id, query);
  return (
    <BottomSheet visible onClose={onClose} closeLabel={t('common.cancel')}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>
          {t('contacts.choose')}
        </Text>
        <NativeButton label={t('common.cancel')} onPress={onClose} variant="quiet" />
        <Field
          label={t('contacts.search')}
          accessibilityLabel={t('contacts.search')}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {failed || error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error ?? t('contacts.error.storage')}
          </Text>
        ) : null}
        <Text style={styles.title}>{t('settings.addressBook')}</Text>
        {matches.map(contact => (
          <ListRow
            key={contact.id}
            title={contact.name}
            subtitle={contactSubtitle(contact)}
            onPress={() => {
              try {
                onSelect(contactRecipient(book, contact.id));
              } catch (caught) {
                setError(contactError(caught, t));
              }
            }}
          />
        ))}
        <Text style={styles.title}>{t('settings.accounts')}</Text>
        {own.map(account => (
          <ListRow
            key={account.id}
            title={account.label || account.address}
            subtitle={account.address}
            onPress={() => onSelect({ address: account.address })}
          />
        ))}
        {!failed && !matches.length && !own.length ? <Text style={styles.hint}>{t('contacts.noMatches')}</Text> : null}
      </ScrollView>
    </BottomSheet>
  );
}
