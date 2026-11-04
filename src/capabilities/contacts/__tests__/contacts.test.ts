import {
  contactIdentity,
  findContact,
  saveContact,
  searchContacts,
  validateContactMemo,
  type Contacts,
  type Contact,
} from '../contacts';

describe('contact identity', () => {
  const row: Contact = {
    id: '1',
    networkId: 'test',
    name: 'Exchange',
    address: 'GVALID',
    memo: { type: 'id', value: '7' },
  };
  it('canonicalizes memo IDs without conflating memo types or absent memo', () => {
    expect(contactIdentity('GVALID', { type: 'id', value: '007' })).toBe(contactIdentity(row.address, row.memo));
    expect(findContact([row], row.address)).toBeUndefined();
    expect(findContact([row], row.address, { type: 'text', value: '7' })).toBeUndefined();
    expect(findContact([row], row.address, { type: 'id', value: '007' })).toBe(row);
  });
  it.each([
    null,
    'memo',
    {},
    { type: 'none', value: '' },
    { type: 'id', value: 7 },
    { type: 'text', value: '' },
  ])('rejects an unsupported runtime memo instead of treating it as absent: %p', memo => {
    expect(() => validateContactMemo(memo)).toThrow('contact-memo-invalid');
    expect(() => contactIdentity(row.address, memo as unknown as Contact['memo'])).toThrow('contact-memo-invalid');
    expect(() => findContact([{ ...row, memo: memo as unknown as Contact['memo'] }], row.address)).toThrow();
  });
  it('preserves canonical Return Memo identity separately from Hash and rejects malformed Return', () => {
    const hex = 'AB'.repeat(32);
    const canonical = 'ab'.repeat(32);
    expect(validateContactMemo({ type: 'return', value: hex })).toEqual({ type: 'return', value: canonical });
    expect(contactIdentity('GVALID', { type: 'return', value: hex })).not.toBe(
      contactIdentity('GVALID', { type: 'hash', value: canonical }),
    );
    expect(() => validateContactMemo({ type: 'return', value: 'ab' })).toThrow('payment-memo-return-invalid');
    expect(findContact([{ ...row, memo: { type: 'return', value: canonical } }], 'GVALID', {
      type: 'hash', value: canonical,
    })).toBeUndefined();
  });
  it('does not guess an identity when legacy contacts from two networks conflict', () => {
    expect(findContact([row, { ...row, id: 'other', networkId: 'main' }], row.address, row.memo)).toBeUndefined();
    expect(searchContacts([row, { ...row, id: 'other', networkId: 'main' }], 'Exchange')).toHaveLength(2);
  });
  it('validates before storage and preserves canonical values', () => {
    const save = jest.fn();
    const dependencies: Contacts = {
      store: { save, list: () => [], remove: jest.fn(), getRevision: () => 0, subscribe: () => () => {} },
      isClassicAccountAddress: address => address === 'GVALID',
      createId: () => 'new',
    };
    expect(() => saveContact(dependencies, 'test', { name: '  ', address: 'GVALID' })).toThrow('contact-name-invalid');
    expect(() => saveContact(dependencies, 'test', { name: 'A', address: 'MUNSUPPORTED' })).toThrow(
      'contact-address-invalid',
    );
    expect(() =>
      saveContact(dependencies, 'test', {
        name: 'A',
        address: 'GVALID',
        memo: { type: 'id', value: '18446744073709551616' },
      }),
    ).toThrow();
    expect(save).not.toHaveBeenCalled();
    saveContact(dependencies, 'test', { name: ' A ', address: ' GVALID ', memo: { type: 'id', value: '007' } });
    expect(save).toHaveBeenCalledWith({
      id: 'new',
      networkId: 'test',
      name: 'A',
      address: 'GVALID',
      memo: { type: 'id', value: '7' },
    });
    expect(searchContacts([row], 'exchange')).toEqual([row]);
  });
});
