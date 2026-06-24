import { pool } from '../config/db.js';
import { queries } from '../db/queries.js';
import { decodeAccessTokenUnsafe, signAccessToken } from '../utils/jwt.js';
import { verifyPassword, hashPassword } from '../utils/password.js';
import { getBranding } from './branding.service.js';
import { writeAudit } from './audit.service.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendMail, getPublicAppUrl } from './mail.service.js';

export async function getSession({ userId, activeOrganizationId }) {
  const [rows] = await pool.query(queries.sessionUserWithOrg, {
    userId,
  });
  if (!rows.length) {
    const err = new Error('Session invalid');
    err.status = 401;
    throw err;
  }
  const row = rows[0];
  if (row.organization_id !== activeOrganizationId) {
    const err = new Error('Active organization no longer available');
    err.status = 403;
    throw err;
  }
  const branding = await getBranding(row.organization_id);
  return {
    user: {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.user_role,
    },
    activeOrganization: {
      id: row.organization_id,
      name: row.org_name,
      slug: row.org_slug,
      roleCode: row.role_code,
      roleName: row.role_name ?? row.role_code,
    },
    branding,
  };
}

export async function login({ email, password }) {
  const normEmail = String(email ?? '').trim().toLowerCase();
  if (!normEmail || !password) {
    const err = new Error('Email and password are required');
    err.status = 400;
    throw err;
  }

  const [rows] = await pool.query(queries.loginUserWithOrg, {
    email: normEmail,
  });

  if (!rows.length) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  const row = rows[0];
  if (row.user_status !== 'active') {
    const err = new Error('Account disabled');
    err.status = 403;
    throw err;
  }

  if (row.org_status !== 'active') {
    const err = new Error('Organization suspended');
    err.status = 403;
    throw err;
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  await pool.query(queries.updateUserLastLogin, { userId: row.user_id });

  await writeAudit({
    organizationId: row.organization_id,
    actorUserId: row.user_id,
    actorRole: row.role_code,
    action: 'auth.login',
    resourceType: 'session',
    resourceId: row.user_id,
    detail: { email: row.email },
  });

  const token = signAccessToken({
    sub: String(row.user_id),
    email: row.email,
    oid: String(row.organization_id),
    role: row.role_code,
  });

  const branding = await getBranding(row.organization_id);

  return {
    token,
    user: {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.user_role,
    },
    activeOrganization: {
      id: row.organization_id,
      name: row.org_name,
      slug: row.org_slug,
      roleCode: row.role_code,
      roleName: row.role_name ?? row.role_code,
    },
    branding,
  };
}

export async function logout({ userId, organizationId, role, email }) {
  await writeAudit({
    organizationId,
    actorUserId: userId,
    actorRole: role,
    action: 'auth.logout',
    resourceType: 'session',
    resourceId: userId,
    detail: email ? { email } : null,
  });
  return { ok: true };
}

export async function recordSessionExpiry(token) {
  const decoded = decodeAccessTokenUnsafe(token);
  if (!decoded?.sub) {
    const err = new Error('Invalid token');
    err.status = 400;
    throw err;
  }
  await writeAudit({
    organizationId: decoded.oid ? Number(decoded.oid) : null,
    actorUserId: Number(decoded.sub),
    actorRole: decoded.role ?? null,
    action: 'auth.session_expired',
    resourceType: 'session',
    resourceId: decoded.sub,
    detail: decoded.email ? { email: decoded.email } : null,
  });
  return { ok: true };
}

export async function forgotPassword({ email, reqOrigin }) {
  const normEmail = String(email ?? '').trim().toLowerCase();
  if (!normEmail) {
    const err = new Error('Email is required');
    err.status = 400;
    throw err;
  }

  // 1. Look up user by email
  const [users] = await pool.query(
    'SELECT id, email, full_name FROM tb_cpanel_users WHERE email = :email LIMIT 1',
    { email: normEmail }
  );

  if (!users.length) {
    // Return ok: true to avoid email scanning
    return { ok: true, message: 'If this email exists in our system, we have sent a reset link.' };
  }

  const user = users[0];

  // 2. Generate signed token (valid for 15m)
  const resetToken = jwt.sign(
    { sub: String(user.id), email: user.email },
    env.jwt.secret,
    { expiresIn: '15m' }
  );

  // 3. Build reset link
  let appUrl = getPublicAppUrl();
  if (!appUrl) {
    appUrl = reqOrigin || 'http://localhost:5173';
  }
  const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  // 4. HTML Template
  const html = `
    <div style="background-color: #f8fafc; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #1e293b; padding: 24px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Techtrole Control Panel</h2>
        </div>
        <div style="padding: 32px 24px;">
          <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 600;">Password Reset Request</h3>
          <p>Hello ${user.full_name},</p>
          <p>We received a request to reset the password for your account associated with <strong>${user.email}</strong>.</p>
          <p>Click the button below to choose a new password. This link is only valid for the next <strong>15 minutes</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 15px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2);">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">If you are having trouble clicking the button, copy and paste the URL below into your browser:</p>
          <p style="font-size: 12px; word-break: break-all; color: #3b82f6; background-color: #f1f5f9; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0;">${resetLink}</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
      </div>
      <div style="text-align: center; margin-top: 16px; font-size: 12px; color: #94a3b8;">
        &copy; ${new Date().getFullYear()} Techtrole. All rights reserved.
      </div>
    </div>
  `;

  // 5. Send Email
  await sendMail({
    to: user.email,
    subject: 'Reset your Techtrole Control Panel password',
    text: `Reset your password here: ${resetLink}`,
    html,
  });

  return { ok: true, message: 'If this email exists in our system, we have sent a reset link.' };
}

export async function resetPassword({ token, password }) {
  if (!token || !password) {
    const err = new Error('Token and password are required');
    err.status = 400;
    throw err;
  }

  // 1. Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, env.jwt.secret);
  } catch (e) {
    const err = new Error('Invalid or expired password reset token');
    err.status = 400;
    throw err;
  }

  const userId = decoded.sub;

  // 2. Hash new password
  const passwordHash = await hashPassword(password);

  // 3. Update database
  await pool.query(
    'UPDATE tb_cpanel_users SET password_hash = :passwordHash, updated_at = CURRENT_TIMESTAMP WHERE id = :userId LIMIT 1',
    { passwordHash, userId }
  );

  return { ok: true, message: 'Password updated successfully' };
}

export async function changePassword({ userId, oldPassword, newPassword }) {
  if (!userId || !oldPassword || !newPassword) {
    const err = new Error('All password fields are required');
    err.status = 400;
    throw err;
  }

  // 1. Fetch user's current password hash
  const [rows] = await pool.query(
    'SELECT password_hash FROM tb_cpanel_users WHERE id = :userId LIMIT 1',
    { userId }
  );

  if (!rows.length) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const user = rows[0];

  // 2. Verify old password
  const ok = await verifyPassword(oldPassword, user.password_hash);
  if (!ok) {
    const err = new Error('Incorrect current password');
    err.status = 400;
    throw err;
  }

  // 3. Hash new password
  const newHash = await hashPassword(newPassword);

  // 4. Update password hash in db
  await pool.query(
    'UPDATE tb_cpanel_users SET password_hash = :newHash, updated_at = CURRENT_TIMESTAMP WHERE id = :userId LIMIT 1',
    { newHash, userId }
  );

  return { ok: true, message: 'Password changed successfully' };
}

