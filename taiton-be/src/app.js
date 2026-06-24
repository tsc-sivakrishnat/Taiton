import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pingDb } from './config/db.js';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { navigationRouter } from './routes/navigation.routes.js';
import { orgRouter } from './routes/org.routes.js';
import { supportRouter } from './routes/support.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { platformRouter } from './routes/platform.routes.js';
import { customerRequestsRouter } from './routes/customerRequests.routes.js';
import { contentRouter } from './routes/content.routes.js';
import { permissionsRouter } from './routes/permissions.routes.js';
import * as brandingService from './services/branding.service.js';
import * as hostingMetricsService from './services/hostingMetrics.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

export function createApp() {
  if (process.env.NODE_ENV !== 'test') {
    hostingMetricsService.startCollector();
  }

  const app = express();

  // Track entry processes (concurrent HTTP requests)
  app.use(hostingMetricsService.trackRequest);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigin === '*' ? true : env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '512kb' }));

  const uploadsAbs = path.resolve(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsAbs, { maxAge: '7d', index: false }));

  const API = '/api';

  app.get(`${API}/health`, async (_req, res) => {
    try {
      await pingDb();
      res.json({ ok: true, db: true });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

  app.get(`${API}/public/branding`, async (req, res) => {
    try {
      const org = String(req.query.org ?? '').trim();
      const branding = await brandingService.getBrandingByOrgCode(org);
      res.json({ branding });
    } catch (e) {
      res.status(500).json({ error: e.message ?? 'Server error' });
    }
  });

  app.use(`${API}/auth`, authRouter);
  app.use(`${API}/dashboard`, dashboardRouter);
  app.use(`${API}/notifications`, notificationsRouter);
  app.use(`${API}/navigation`, navigationRouter);
  app.use(`${API}/org`, orgRouter);
  app.use(`${API}/support`, supportRouter);
  app.use(`${API}/admin`, adminRouter);
  app.use(`${API}/platform`, platformRouter);
  app.use(`${API}/customer-requests`, customerRequestsRouter);
  app.use(`${API}/content`, contentRouter);
  app.use(`${API}/permissions`, permissionsRouter);

  app.use(express.static(publicDir));

  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith(API) || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(publicDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
