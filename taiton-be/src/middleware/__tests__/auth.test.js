import { jest } from '@jest/globals';
import { signAccessToken } from '../../utils/jwt.js';

const { requireAuth } = await import('../auth.js');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('requireAuth middleware', () => {
  it('returns 401 when Authorization header missing', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches auth payload when token valid', () => {
    const token = signAccessToken({ sub: '9', oid: '2', role: 'org_admin' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.auth).toEqual({
      userId: 9,
      organizationId: 2,
      role: 'org_admin',
      email: null,
    });
  });

  it('returns 401 for invalid token', () => {
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = mockRes();
    const next = jest.fn();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
