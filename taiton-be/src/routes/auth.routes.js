import { Router } from 'express';
import * as authService from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  try {
    const body = await authService.login({
      email: req.body?.email,
      password: req.body?.password,
    });
    res.json(body);
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({
    userId: req.auth.userId,
    email: req.auth.email,
    organizationId: req.auth.organizationId,
    role: req.auth.role,
  });
});

/** One round-trip to rebuild user + org list after a hard refresh */
authRouter.get('/session', requireAuth, async (req, res) => {
  try {
    const body = await authService.getSession({
      userId: req.auth.userId,
      activeOrganizationId: req.auth.organizationId,
    });
    res.json(body);
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

authRouter.post('/logout', requireAuth, async (req, res) => {
  try {
    await authService.logout({
      userId: req.auth.userId,
      organizationId: req.auth.organizationId,
      role: req.auth.role,
      email: req.auth.email,
    });
    res.json({ ok: true });
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

authRouter.post('/session-expired', async (req, res) => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.body?.token;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    await authService.recordSessionExpiry(token);
    res.json({ ok: true });
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

authRouter.post('/forgot-password', async (req, res) => {
  try {
    const body = await authService.forgotPassword({
      email: req.body?.email,
      reqOrigin: req.headers.origin,
    });
    res.json(body);
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

authRouter.post('/reset-password', async (req, res) => {
  try {
    const body = await authService.resetPassword({
      token: req.body?.token,
      password: req.body?.password,
    });
    res.json(body);
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  try {
    const body = await authService.changePassword({
      userId: req.auth.userId,
      oldPassword: req.body?.oldPassword,
      newPassword: req.body?.newPassword,
    });
    res.json(body);
  } catch (e) {
    const status = e.status ?? 500;
    res.status(status).json({ error: e.message ?? 'Server error' });
  }
});

