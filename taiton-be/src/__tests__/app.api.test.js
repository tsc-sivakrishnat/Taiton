import { jest } from '@jest/globals';
import request from 'supertest';

jest.unstable_mockModule('../config/db.js', () => ({
  pool: { query: jest.fn() },
  pingDb: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule('../services/branding.service.js', () => ({
  getBrandingByOrgCode: jest.fn().mockResolvedValue({ appName: 'Test Org' }),
  getBranding: jest.fn().mockResolvedValue({ appName: 'Test Org' }),
}));

const { createApp } = await import('../app.js');

describe('API integration (supertest)', () => {
  const app = createApp();

  it('GET /api/health returns ok when db pings', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });

  it('GET /api/navigation requires auth', async () => {
    const res = await request(app).get('/api/navigation');
    expect(res.status).toBe(401);
  });

  it('GET /api/dashboard/hosting-metrics requires auth', async () => {
    const res = await request(app).get('/api/dashboard/hosting-metrics');
    expect(res.status).toBe(401);
  });

  it('GET /api/public/branding returns branding', async () => {
    const res = await request(app).get('/api/public/branding').query({ org: 'acme' });
    expect(res.status).toBe(200);
    expect(res.body.branding.appName).toBe('Test Org');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
  });
});
