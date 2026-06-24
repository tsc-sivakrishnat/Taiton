import { isPlatformRole, getPermissionGrant } from '../permissions.service.js';

describe('permissions.service', () => {
  describe('isPlatformRole', () => {
    it('identifies platform roles', () => {
      expect(isPlatformRole('sys_admin')).toBe(true);
      expect(isPlatformRole('super_admin')).toBe(true);
      expect(isPlatformRole('org_admin')).toBe(false);
    });
  });

  describe('getPermissionGrant', () => {
    it('grants org_admin all non-platform permissions without DB', async () => {
      const grant = await getPermissionGrant('org_admin', 'org.users.manage');
      expect(grant.allowed).toBe(true);
      expect(grant.accessLevel).toBe('direct');
    });

    it('denies org_admin platform permissions', async () => {
      const grant = await getPermissionGrant('org_admin', 'platform.orgs.manage');
      expect(grant.allowed).toBe(false);
    });

    it('grants sys_admin platform permissions without DB', async () => {
      const grant = await getPermissionGrant('sys_admin', 'platform.nav.manage');
      expect(grant.allowed).toBe(true);
    });
  });
});
