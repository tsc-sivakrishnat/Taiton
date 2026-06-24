import { jest } from '@jest/globals';
import {
  startCollector,
  stopCollector,
  getMetrics,
  collectMetrics,
  trackRequest,
  getActiveRequests,
} from '../hostingMetrics.service.js';

describe('hostingMetrics.service', () => {
  beforeEach(() => {
    stopCollector();
  });

  afterEach(() => {
    stopCollector();
  });

  it('provides a structured cache mapping cPanel layout limits', () => {
    const metrics = getMetrics();
    expect(metrics).toHaveProperty('cpu');
    expect(metrics.cpu.limit).toBe(100);
    expect(metrics.cpu.unitLabel).toBe('%');

    expect(metrics).toHaveProperty('memory');
    expect(metrics.memory.limit).toBe(2048);
    expect(metrics.memory.unitLabel).toBe('MB');

    expect(metrics).toHaveProperty('io');
    expect(metrics.io.limit).toBe(12288);
  });

  it('seeds cached datapoints when startCollector is run', () => {
    startCollector();
    const metrics = getMetrics();
    expect(metrics.cpu.datapoints.length).toBeGreaterThanOrEqual(5);
    expect(metrics.memory.datapoints.length).toBeGreaterThanOrEqual(5);
  });

  it('runs collectMetrics to capture system stats', async () => {
    startCollector();
    const metricsBefore = JSON.parse(JSON.stringify(getMetrics()));
    await collectMetrics();
    const metricsAfter = getMetrics();
    expect(metricsAfter.cpu.datapoints.length).toBe(5);
    // Values are updated or shifted
    expect(metricsAfter.cpu.datapoints[4].timestamp).toBeGreaterThanOrEqual(
      metricsBefore.cpu.datapoints[4].timestamp
    );
  });

  it('tracks active requests inside trackRequest middleware', () => {
    const req = {};
    const listeners = {};
    const res = {
      on: (event, handler) => {
        listeners[event] = handler;
      },
    };
    const next = jest.fn();

    const initialCount = getActiveRequests();
    trackRequest(req, res, next);
    expect(getActiveRequests()).toBe(initialCount + 1);
    expect(next).toHaveBeenCalled();

    // Trigger completion
    if (listeners['finish']) {
      listeners['finish']();
    }
    expect(getActiveRequests()).toBe(initialCount);
  });
});
