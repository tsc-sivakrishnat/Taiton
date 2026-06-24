/** Turn MySQL errors into short messages for the UI (never expose SQL details). */

export function mapDbErrorToClient(error) {
  const msg = String(error?.message ?? error ?? '');
  if (!msg.includes('Duplicate')) return null;

  const entry = msg.match(/Duplicate entry '([^']*)'/i)?.[1] ?? '';

  if (entry.includes('@') || /uk_cpanel_user_email|user.*email/i.test(msg)) {
    return { message: 'This email is already registered.', status: 409 };
  }
  if (/uk_cpanel_user_org_email/i.test(msg)) {
    return { message: 'This email is already in this organization.', status: 409 };
  }
  if (/org_code|organization/i.test(msg)) {
    return { message: 'This organization code is already taken.', status: 409 };
  }
  if (/org_role|tb_cpanel_org_roles/i.test(msg)) {
    return { message: 'This role name already exists here.', status: 409 };
  }

  return { message: 'This record already exists.', status: 409 };
}

export function rethrowAsClientError(error) {
  const mapped = mapDbErrorToClient(error);
  if (mapped) {
    const err = new Error(mapped.message);
    err.status = mapped.status;
    throw err;
  }
  throw error;
}
