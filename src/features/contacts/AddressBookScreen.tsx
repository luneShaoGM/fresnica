import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { searchContacts, type Contact } from '@capabilities/contacts/contacts';
import { Field, ListRow, StateView } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { SettingsSubpage } from '../settings/SettingsSubpage';
import { ContactEditor } from './ContactEditor';
import { contactSubtitle, type ContactBook } from './contactBook';
import { createStyles } from './styles';
import { useContactList } from './useContactList';

type Selection = { kind: 'add' } | { kind: 'contact'; contact: Contact };
export function AddressBookScreen({
  book,
  onBack,
  active = true,
}: Readonly<{ book: ContactBook; onBack(): void; active?: boolean }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>();
  const selectionRef = useRef<Selection | undefined>(undefined);
  const live = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      selectionRef.current = undefined;
    };
  }, []);
  const choose = (value: Selection) => {
    if (live.current && activeRef.current) {
      selectionRef.current = value;
      setSelection(value);
    }
  };
  const [, retry] = useState(0);
  const { contacts, failed } = useContactList(book);
  const matches = searchContacts(contacts, query);
  const close = () => {
    selectionRef.current = undefined;
    setSelection(undefined);
  };
  useEffect(() => {
    if (!active) close();
  }, [active]);
  const selected =
    selection?.kind === 'contact' ? contacts.find(contact => contact.id === selection.contact.id) : undefined;
  return (
    <SettingsSubpage title={t('settings.addressBook')} onBack={selection ? close : onBack}>
      {selection ? (
        <>
          {selection.kind === 'contact' && !selected ? (
            <StateView
              kind="error"
              title={t('contacts.error.missing')}
              message={t('contacts.error.missing')}
              actionLabel={t('common.back')}
              onAction={close}
            />
          ) : (
            <ContactEditor
              key={selected?.id ?? 'new'}
              book={book}
              initial={selected}
              id={selected?.id}
              onClose={close}
              isCurrent={() => live.current && activeRef.current && selectionRef.current === selection}
            />
          )}
        </>
      ) : (
        <>
          <Text style={styles.hint}>{t('contacts.local')}</Text>
          <Field
            label={t('contacts.search')}
            accessibilityLabel={t('contacts.search')}
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
          />
          <NativeButton label={t('contacts.add')} variant="primary" onPress={() => choose({ kind: 'add' })} />
          {failed ? (
            <StateView
              kind="error"
              title={t('contacts.error.storage')}
              message={t('contacts.error.storage')}
              actionLabel={t('activity.retry')}
              onAction={() => retry(value => value + 1)}
            />
          ) : matches.length === 0 ? (
            <StateView
              kind="empty"
              title={t('contacts.empty')}
              message={t(query ? 'contacts.noMatches' : 'contacts.emptyDetail')}
            />
          ) : (
            matches.map(contact => (
              <ListRow
                key={contact.id}
                title={contact.name}
                subtitle={contactSubtitle(contact)}
                onPress={() => choose({ kind: 'contact', contact })}
              />
            ))
          )}
        </>
      )}
    </SettingsSubpage>
  );
}
