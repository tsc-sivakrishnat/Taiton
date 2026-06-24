import { jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../config/db.js', () => ({
  pool: { query: mockQuery },
}));

const { listNavForOrgAndRole } = await import('../navigation.service.js');

describe('navigation.service', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('filters nav items by role in application layer', async () => {
    mockQuery.mockResolvedValue([
      [
        {
          id: 1,
          label: 'Testing',
          icon: 'Circle',
          route: '/app/testing',
          position: 'top',
          sort_order: 20,
          roles_csv: 'org_admin,super_employee',
        },
        {
          id: 2,
          label: 'Admin only',
          icon: 'Circle',
          route: '/app/admin-only',
          position: 'top',
          sort_order: 21,
          roles_csv: 'org_admin',
        },
      ],
    ]);

    const items = await listNavForOrgAndRole({
      organizationId: 1,
      roleCode: 'super_employee',
    });

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Testing');
    expect(items[0].rolesCsv).toBe('org_admin,super_employee');
  });

  it('includes items with empty roles_csv for any role', async () => {
    mockQuery.mockResolvedValue([
      [
        {
          id: 3,
          label: 'Everyone',
          icon: 'Circle',
          route: '/app/all',
          position: 'top',
          sort_order: 1,
          roles_csv: null,
        },
      ],
    ]);

    const items = await listNavForOrgAndRole({
      organizationId: 1,
      roleCode: 'employee',
    });

    expect(items).toHaveLength(1);
  });

  it('excludes notification route', async () => {
    mockQuery.mockResolvedValue([
      [
        {
          id: 4,
          label: 'Notifications',
          icon: 'Bell',
          route: '/app/notifications',
          position: 'top',
          sort_order: 99,
          roles_csv: null,
        },
      ],
    ]);

    const items = await listNavForOrgAndRole({
      organizationId: 1,
      roleCode: 'org_admin',
    });

    expect(items).toHaveLength(0);
  });
});
