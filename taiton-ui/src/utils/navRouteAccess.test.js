import { describe, it, expect } from 'vitest';
import { canAccessNavRoute, filterNavItemsByRouteAccess } from './navRouteAccess.js';

const orgAdminCan = (perm) => {
  if (perm?.startsWith('platform.')) return false;
  return true;
};

describe('navRouteAccess', () => {
  it('allows org_admin on org routes', () => {
    expect(
      canAccessNavRoute('/app/org/users', {
        roleCode: 'org_admin',
        can: orgAdminCan,
        isPlatformAdmin: false,
      }),
    ).toBe(true);
  });

  it('denies super_employee on accounts route', () => {
    expect(
      canAccessNavRoute('/app/accounts', {
        roleCode: 'super_employee',
        can: () => true,
        isPlatformAdmin: false,
      }),
    ).toBe(false);
  });

  it('allows custom routes by default', () => {
    expect(
      canAccessNavRoute('/app/testing', {
        roleCode: 'super_employee',
        can: () => false,
        isPlatformAdmin: false,
      }),
    ).toBe(true);
  });

  it('allows restricted route if it is assigned in navItems even if user lacks permission', () => {
    expect(
      canAccessNavRoute('/app/org/users', {
        roleCode: 'super_employee',
        can: () => false,
        isPlatformAdmin: false,
        navItems: [{ route: '/app/org/users' }],
      }),
    ).toBe(true);
  });

  it('filterNavItemsByRouteAccess removes forbidden items', () => {
    const items = [
      { route: '/app/accounts', label: 'Accounts' },
      { route: '/app/testing', label: 'Testing' },
    ];
    const filtered = filterNavItemsByRouteAccess(items, {
      roleCode: 'super_employee',
      can: () => true,
      isPlatformAdmin: false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].route).toBe('/app/testing');
  });
});
