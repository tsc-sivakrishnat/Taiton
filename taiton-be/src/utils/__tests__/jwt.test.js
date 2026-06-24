import { signAccessToken, verifyAccessToken } from '../jwt.js';

describe('jwt utilities', () => {
  it('signs and verifies access token payload', () => {
    const token = signAccessToken({
      sub: '42',
      oid: '1',
      role: 'org_admin',
      email: 'admin@test.com',
    });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.oid).toBe('1');
    expect(decoded.role).toBe('org_admin');
  });

  it('rejects invalid token', () => {
    expect(() => verifyAccessToken('not.a.token')).toThrow();
  });
});
