import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../api/client';
import { authService } from '../services';
import type { PublicUser } from '../services/types';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setUser(null);
    });
    const token = tokenStore.get();
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  };

  const register = async (data: { firstName: string; lastName: string; email: string; password: string }) => {
    const result = await authService.register(data);
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    delete api.defaults.headers.common.Authorization;
  };

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
