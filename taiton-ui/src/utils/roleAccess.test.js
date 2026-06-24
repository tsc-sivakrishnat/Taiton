import { describe, it, expect } from 'vitest';
import { roleMatchesCsv } from './roleAccess.js';

describe('roleMatchesCsv', () => {
  it('matches role in csv list', () => {
    expect(roleMatchesCsv('org_admin', 'org_admin,super_employee')).toBe(true);
  });

  it('allows all when csv empty', () => {
    expect(roleMatchesCsv('employee', null)).toBe(true);
    expect(roleMatchesCsv('employee', '')).toBe(true);
  });

  it('rejects when role not listed', () => {
    expect(roleMatchesCsv('employee', 'org_admin')).toBe(false);
  });
});
