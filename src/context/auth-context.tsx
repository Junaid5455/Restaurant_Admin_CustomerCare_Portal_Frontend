'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '@/lib/api/auth';
import { clearAuthCookies, getRefreshToken, setRoleCookie, setTokens } from '@/lib/cookies';
import type { RegisterInput, User } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const establish = useCallback((access: string, refresh: string, u: User) => {
    setTokens(access, refresh);
    setRoleCookie(u.role);
    setUser(u);
    setStatus('authenticated');
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getRefreshToken()) {
        setStatus('anonymous');
        return;
      }
      try {
        const me = await authApi.me();
        if (cancelled) return;
        setRoleCookie(me.role);
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        clearAuthCookies();
        setUser(null);
        setStatus('anonymous');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      establish(data.access_token, data.refresh_token, data.user);
      return data.user;
    },
    [establish],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const data = await authApi.register(input);
      establish(data.access_token, data.refresh_token, data.user);
      return data.user;
    },
    [establish],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clearAuthCookies();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      /* keep the existing user */
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshUser }),
    [user, status, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
