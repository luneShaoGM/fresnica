import type { Contact } from '@capabilities/contacts/contacts';
import type { SectionedListSection } from '@ui/components/SectionedList';

export function groupContactsByInitial(contacts: readonly Contact[]): readonly SectionedListSection<Contact>[] {
  const groups = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const initial = Array.from(contact.name.trim())[0]?.toLocaleUpperCase() ?? '#';
    const title = initial;
    const group = groups.get(title) ?? [];
    group.push(contact);
    groups.set(title, group);
  }
  return Array.from(groups, ([title, data]) => ({
    title,
    data: data.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
  })).sort((a, b) => a.title.localeCompare(b.title));
}
