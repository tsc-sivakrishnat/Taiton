import { hashPassword, verifyPassword } from '../password.js';

describe('password utilities', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('SecretPass1!');
    expect(hash).not.toBe('SecretPass1!');
    expect(await verifyPassword('SecretPass1!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
