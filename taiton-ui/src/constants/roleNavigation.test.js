import { describe, it, expect } from 'vitest';
import {
  getRoleNavigation,
  shouldMergeOrgNavApi,
  isPlatformOperatorRole,
} from './roleNavigation.js';

describe('roleNavigation', () => {
  it('getRoleNavigation returns null since it is deprecated in favor of dynamic DB-driven nav', () => {
    expect(getRoleNavigation('sys_admin')).toBeNull();
    expect(getRoleNavigation('org_admin')).toBeNull();
  });

  it('shouldMergeOrgNavApi returns false for all roles since all roles are now dynamic', () => {
    expect(shouldMergeOrgNavApi('org_admin')).toBe(false);
    expect(shouldMergeOrgNavApi('super_employee')).toBe(false);
  });

  it('isPlatformOperatorRole identifies platform roles correctly', () => {
    expect(isPlatformOperatorRole('sys_admin')).toBe(true);
    expect(isPlatformOperatorRole('org_admin')).toBe(false);
  });
});
