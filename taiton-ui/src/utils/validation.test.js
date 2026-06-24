import { describe, it, expect } from 'vitest';
import { v, validateAll } from './validation.js';

describe('validation utilities', () => {
  it('validates email', () => {
    expect(v.email('')).toMatch(/required/i);
    expect(v.email('bad')).toMatch(/valid email/i);
    expect(v.email('user@example.com')).toBeNull();
  });

  it('validates org code', () => {
    expect(v.orgCode('')).toMatch(/required/i);
    expect(v.orgCode('acme!')).toMatch(/characters/i);
    expect(v.orgCode('ACME-CORP')).toBeNull();
  });

  it('validates mobile10', () => {
    expect(v.mobile10('12345')).toMatch(/10 digits/i);
    expect(v.mobile10('9876543210')).toBeNull();
  });

  it('validateAll returns first error', () => {
    const err = validateAll([
      () => v.email(''),
      () => v.name('Test'),
    ]);
    expect(err).toMatch(/email/i);
  });

  it('validateAll returns null when all pass', () => {
    expect(
      validateAll([() => v.email('a@b.com'), () => v.name('Test')]),
    ).toBeNull();
  });
});
