import {MAIN_TABS, PRODUCT_ACTIONS, PRODUCT_ROUTES} from '../productRoutes';

describe('navigation contract', () => {
  it('uses the approved four selectable tabs', () => {
    expect(MAIN_TABS).toEqual(['home', 'activity', 'dapps', 'settings']);
    expect(MAIN_TABS).not.toContain('actions');
    expect(MAIN_TABS).not.toContain('events');
    expect(MAIN_TABS).not.toContain('xapps');
  });

  it('keeps Actions separate from tabs', () => {
    expect(PRODUCT_ACTIONS).toEqual(['send', 'swap', 'request']);
  });

  it('keeps Activity and dApps in their target route inventories', () => {
    expect(PRODUCT_ROUTES.activity).toEqual(['activity', 'operation-details']);
    expect(PRODUCT_ROUTES.dapps).toEqual(['dapps']);
  });

  it('keeps account detail inside Settings history instead of borrowing the Home stack', () => {
    expect(PRODUCT_ROUTES.settings).toContain('account-details');
    expect(PRODUCT_ROUTES.settings).toContain('add-account');
    expect(PRODUCT_ROUTES.home).not.toContain('account-details');
  });

  it('keeps asset detail in Home with a stable public route identity', () => {
    expect(PRODUCT_ROUTES.home).toContain('asset-details');
  });
});
