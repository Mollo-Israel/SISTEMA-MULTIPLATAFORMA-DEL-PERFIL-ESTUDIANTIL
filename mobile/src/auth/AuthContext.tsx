import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import { authService, type PublicUser } from '../services';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await tokenStore.clear();
      setUser(null);
    });
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setUser(await authService.me());
      } catch {
        await tokenStore.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    await tokenStore.set(result.accessToken);
    setUser(result.user);
  };

  const register = async (data: { firstName: string; lastName: string; email: string; password: string }) => {
    const result = await authService.register(data);
    await tokenStore.set(result.accessToken);
    setUser(result.user);
  };

  const logout = async () => {
    await tokenStore.clear();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
