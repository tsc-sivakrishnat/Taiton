import { mapDbErrorToClient, rethrowAsClientError } from '../mapDbError.js';

describe('mapDbErrorToClient', () => {
  it('maps duplicate email to friendly message', () => {
    const err = { message: "Duplicate entry 'a@b.com' for key 'uk_cpanel_user_email'" };
    expect(mapDbErrorToClient(err)).toEqual({
      message: 'This email is already registered.',
      status: 409,
    });
  });

  it('maps duplicate org code', () => {
    const err = { message: "Duplicate entry 'ACME' for key 'org_code'" };
    expect(mapDbErrorToClient(err)?.message).toBe('This organization code is already taken.');
  });

  it('returns null for non-duplicate errors', () => {
    expect(mapDbErrorToClient({ message: 'Connection lost' })).toBeNull();
  });
});

describe('rethrowAsClientError', () => {
  it('throws mapped client error', () => {
    expect(() =>
      rethrowAsClientError({ message: "Duplicate entry 'x' for key 'uk_cpanel_user_email'" }),
    ).toThrow('This email is already registered.');
  });

  it('rethrows original error when not mapped', () => {
    const original = new Error('Other');
    expect(() => rethrowAsClientError(original)).toThrow(original);
  });
});
