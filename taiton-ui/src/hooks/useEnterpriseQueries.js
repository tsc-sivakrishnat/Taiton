import { useCallback, useEffect, useState } from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { emitUnreadRefresh } from '../utils/events.js';

/**
 * Lightweight client "queries" — one module for data hooks used by pages.
 * Keeps components declarative without scattering fetch logic.
 */

export function useDashboardSummary(token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await enterpriseApi.dashboardSummary(token);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => {
      refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useNotifications(token, { limit, offset } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await enterpriseApi.notifications(token, { limit, offset });
      setItems(res.items ?? []);
    } catch (e) {
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token, limit, offset]);

  useEffect(() => {
    const t = setTimeout(() => {
      refresh();
    }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const markRead = useCallback(
    async (id) => {
      await enterpriseApi.markNotificationRead(token, id);
      await refresh();
      emitUnreadRefresh();
    },
    [token, refresh],
  );

  const markAllRead = useCallback(async () => {
    await enterpriseApi.markAllNotificationsRead(token);
    await refresh();
    emitUnreadRefresh();
  }, [token, refresh]);

  return { items, loading, error, refresh, markRead, markAllRead };
}

export function useHostingMetrics(token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await enterpriseApi.hostingMetrics(token);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load hosting metrics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, loading, error, refresh };
}
