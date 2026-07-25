import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { enterpriseApi } from '../api/enterpriseApi.js';
import { AuthContext } from './authContext.js';

const STORAGE_KEY = 'cpanel.session';
const SIDEBAR_KEY = 'cpanel.sidebarCollapsed';

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(token, snapshot) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token,
      user: snapshot.user,
      activeOrganization: snapshot.activeOrganization,
      branding: snapshot.branding ?? null,
    }),
  );
}

function clearPersisted() {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const stored = loadStored();
  const [token, setToken] = useState(() => stored?.token ?? null);
  const [user, setUser] = useState(() => stored?.user ?? null);
  const [activeOrganization, setActiveOrganization] = useState(
    () => stored?.activeOrganization ?? null,
  );
  const [branding, setBranding] = useState(() => stored?.branding ?? null);
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(stored?.token));
  const [error, setError] = useState(null);
  const [navItems, setNavItems] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [bulkUploading, setBulkUploading] = useState(false);
  const skipSessionOnceRef = useRef(false);

  const setSidebarCollapsed = useCallback((collapsed) => {
    setSidebarCollapsedState(collapsed);
    try {
      if (collapsed) {
        localStorage.setItem(SIDEBAR_KEY, '1');
      } else {
        localStorage.removeItem(SIDEBAR_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(async ({ audit = true } = {}) => {
    const currentToken = token;
    if (audit && currentToken) {
      try {
        await enterpriseApi.logout(currentToken);
      } catch {
        /* session may already be invalid */
      }
    }
    clearPersisted();
    setToken(null);
    setUser(null);
    setActiveOrganization(null);
    setBranding(null);
    setNavItems([]);
    setPermissions([]);
    setError(null);
  }, [token]);

  const applyAuthPayload = useCallback((payload) => {
    setToken(payload.token);
    setUser(payload.user);
    setActiveOrganization(payload.activeOrganization ?? null);
    setBranding(payload.branding ?? null);
    persist(payload.token, {
      user: payload.user,
      activeOrganization: payload.activeOrganization,
      branding: payload.branding,
    });
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) return null;
    const session = await enterpriseApi.session(token);
    setUser(session.user);
    setActiveOrganization(session.activeOrganization ?? null);
    setBranding(session.branding ?? null);
    persist(token, {
      user: session.user,
      activeOrganization: session.activeOrganization,
      branding: session.branding,
    });
    return session;
  }, [token]);

  const loadNavigation = useCallback(async () => {
    if (!token || !activeOrganization?.id) {
      setNavItems([]);
      return;
    }
    try {
      const res = await enterpriseApi.navigation(token);
      setNavItems(res.items ?? []);
    } catch {
      setNavItems([]);
    }
  }, [token, activeOrganization?.id]);

  const loadPermissions = useCallback(async () => {
    if (!token) {
      setPermissions([]);
      return;
    }
    try {
      const res = await enterpriseApi.myPermissions(token);
      setPermissions(res.permissions ?? []);
    } catch {
      setPermissions([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      const t = setTimeout(() => setBootstrapping(false), 0);
      return () => clearTimeout(t);
    }

    if (skipSessionOnceRef.current) {
      skipSessionOnceRef.current = false;
      return undefined;
    }

    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          setError(null);
          const session = await enterpriseApi.session(token);
          if (cancelled) return;
          setUser(session.user);
          setActiveOrganization(session.activeOrganization ?? null);
          setBranding(session.branding ?? null);
          persist(token, {
            user: session.user,
            activeOrganization: session.activeOrganization,
            branding: session.branding,
          });
        } catch {
          if (cancelled) return;
          try {
            await enterpriseApi.sessionExpired(token);
          } catch {
            /* ignore audit failure */
          }
          await logout({ audit: false });
        } finally {
          if (!cancelled) {
            setBootstrapping(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, logout]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadNavigation();
      loadPermissions();
    }, 0);
    return () => clearTimeout(t);
  }, [loadNavigation, loadPermissions]);

  useEffect(() => {
    if (!token) return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadNavigation();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [token, loadNavigation]);

  const login = useCallback(
    async ({ email, password }) => {
      setError(null);
      const body = await enterpriseApi.login({
        email,
        password,
      });
      skipSessionOnceRef.current = true;
      applyAuthPayload(body);
      setBootstrapping(false);
      try {
        const permRes = await enterpriseApi.myPermissions(body.token);
        setPermissions(permRes.permissions ?? []);
      } catch {
        setPermissions([]);
      }
      return body;
    },
    [applyAuthPayload],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      activeOrganization,
      branding,
      setBranding,
      bootstrapping,
      error,
      setError,
      login,
      logout,
      refreshSession,
      navItems,
      refreshNavigation: loadNavigation,
      permissions,
      refreshPermissions: loadPermissions,
      isAuthenticated: Boolean(token && user && activeOrganization),
      sidebarCollapsed,
      setSidebarCollapsed,
      bulkUploading,
      setBulkUploading,
    }),
    [
      token,
      user,
      activeOrganization,
      branding,
      bootstrapping,
      error,
      login,
      logout,
      refreshSession,
      navItems,
      loadNavigation,
      permissions,
      loadPermissions,
      sidebarCollapsed,
      setSidebarCollapsed,
      bulkUploading,
      setBulkUploading,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
