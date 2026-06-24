import { describe, it, expect } from 'vitest';
import {
  mergeNavItemsForRole,
  mergeStaticNavWithApi,
  filterOrgNavApiItems,
  filterApiNavItemsForRole,
} from './mergeNavItems.js';

describe('mergeNavItems', () => {
  it('dedupes by route', () => {
    const items = [
      { id: 1, route: '/app/a', label: 'A' },
      { id: 2, route: '/app/a', label: 'A2' },
    ];
    expect(mergeNavItemsForRole(items)).toHaveLength(1);
  });

  it('merges static nav with api items', () => {
    const staticNav = {
      top: [{ id: 's1', route: '/app/dashboard', label: 'Dashboard' }],
      bottom: [],
    };
    const api = [{ id: 10, route: '/app/testing', label: 'Testing' }];
    const merged = mergeStaticNavWithApi(staticNav, api);
    expect(merged).toHaveLength(2);
    expect(merged.map((i) => i.route)).toContain('/app/testing');
  });

  it('filterOrgNavApiItems blocks platform routes for org users', () => {
    const items = [
      { route: '/app/platform', label: 'Platform' },
      { route: '/app/testing', label: 'Test' },
    ];
    expect(filterOrgNavApiItems(items, 'org_admin')).toHaveLength(1);
    expect(filterOrgNavApiItems(items, 'sys_admin')).toHaveLength(0);
  });

  it('filterApiNavItemsForRole returns all items', () => {
    const items = [
      { route: '/app/a', rolesCsv: 'org_admin' },
      { route: '/app/b', rolesCsv: 'employee' },
    ];
    expect(filterApiNavItemsForRole(items, 'org_admin')).toHaveLength(2);
  });
});
