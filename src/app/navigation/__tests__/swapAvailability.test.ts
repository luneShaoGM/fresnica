import type { AccountRecord } from '@capabilities/account/types';

import { isSwapAvailableForAccount } from '../swapAvailability';

const classicAccount = {
  id: 'classic',
  address: 'GCLASSIC',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  hidden: false,
  label: 'Classic',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
} satisfies AccountRecord;

describe('Swap entry availability', () => {
  it('uses the same Classic signing eligibility for Home and Actions', () => {
    expect(isSwapAvailableForAccount(classicAccount, true)).toBe(true);
    expect(isSwapAvailableForAccount(classicAccount, false)).toBe(false);
    expect(isSwapAvailableForAccount({ ...classicAccount, identityKind: 'contract' }, true)).toBe(false);
  });
});
