import type { Contact } from '@capabilities/contacts/contacts';
import { groupContactsByInitial } from '../contactSections';

const row = (id: string, name: string): Contact => ({
  id,
  name,
  address: 'GADDRESS',
  networkId: 'test',
});

it('groups contacts by name initial, sorts within sections, and keeps legacy duplicate IDs', () => {
  const sections = groupContactsByInitial([
    row('zoe', 'Zoe'),
    row('a2', 'amy'),
    row('a1', 'Alice'),
    row('a3', 'Alice'),
    row('z', 'Zara'),
  ]);
  expect(sections.map(section => section.title)).toEqual(['A', 'Z']);
  expect(sections[0].data.map(contact => contact.id)).toEqual(['a1', 'a3', 'a2']);
  expect(sections[1].data.map(contact => contact.id)).toEqual(['z', 'zoe']);
});

it('keeps non-Latin names rather than dropping contacts or changing identity', () => {
  const sections = groupContactsByInitial([row('chinese', '张三'), row('emoji', '⭐ Star')]);
  expect(sections.flatMap(section => section.data).map(contact => contact.id).sort()).toEqual(['chinese', 'emoji']);
  expect(sections.map(section => section.title)).toContain('张');
});
