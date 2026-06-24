import {
  normalizeRoleCode,
  normalizeRolesCsv,
  roleMatchesNavCsv,
} from '../roleCsv.js';

describe('roleCsv utilities', () => {
  describe('normalizeRoleCode', () => {
    it('lowercases and trims role codes', () => {
      expect(normalizeRoleCode('  ORG_ADMIN  ')).toBe('org_admin');
    });

    it('handles empty values', () => {
      expect(normalizeRoleCode(null)).toBe('');
    });
  });

  describe('normalizeRolesCsv', () => {
    it('normalizes comma-separated roles', () => {
      expect(normalizeRolesCsv(' org_admin , Super_Employee ')).toBe(
        'org_admin,super_employee',
      );
    });

    it('returns null for empty csv', () => {
      expect(normalizeRolesCsv('')).toBeNull();
      expect(normalizeRolesCsv(null)).toBeNull();
    });
  });

  describe('roleMatchesNavCsv', () => {
    it('matches when role is in csv', () => {
      expect(roleMatchesNavCsv('org_admin', 'org_admin,super_employee')).toBe(true);
    });

    it('matches all roles when csv is empty', () => {
      expect(roleMatchesNavCsv('employee', null)).toBe(true);
      expect(roleMatchesNavCsv('employee', '')).toBe(true);
    });

    it('does not match when role absent', () => {
      expect(roleMatchesNavCsv('employee', 'org_admin')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(roleMatchesNavCsv('ORG_ADMIN', 'org_admin')).toBe(true);
    });
  });
});
