import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, renovarSesion, setUnauthorizedHandler, tokenStore } from '../api/client';
import { authService } from '../services';
import type { PublicUser } from '../services/types';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<PublicUser>;
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
    // Tras una recarga no hay access token (vive en memoria): se pide uno con
    // la cookie de sesión. Sin sesión previa, ni se intenta.
    renovarSesion()
      .then((r) => setUser((r?.user as PublicUser | undefined) ?? null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    tokenStore.set(result.accessToken);
    setUser(result.user);
    return result.user;
  };

  /**
   * Cierra la sesión también en el servidor (§14).
   *
   * Si la llamada falla, se limpia igualmente el navegador: el usuario pidió
   * salir y dejarlo dentro sería peor que perder la revocación remota, que
   * el token caducado resolverá por sí sola.
   */
  const logout = () => {
    authService.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
    delete api.defaults.headers.common.Authorization;
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
