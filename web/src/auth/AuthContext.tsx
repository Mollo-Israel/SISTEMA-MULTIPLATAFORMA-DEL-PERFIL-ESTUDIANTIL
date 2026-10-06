import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, renovarSesion, setUnauthorizedHandler, tokenStore } from '../api/client';
import { authService } from '../services';
import type { PublicUser } from '../services/types';
import { viewCache } from '../hooks/viewCache';

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
      viewCache.clear();
      setUser(null);
    });
    // Tras una recarga no hay access token (vive en memoria): se pide uno con
    // la cookie de sesión. Sin sesión previa, ni se intenta. Si falla por algo
    // pasajero (red, 429, 5xx) la marca de sesión sigue en pie y se reintenta
    // un par de veces antes de mandar a nadie al login.
    let vivo = true;
    (async () => {
      let r = await renovarSesion();
      for (let intento = 1; !r && intento <= 2 && tokenStore.hasSession() && vivo; intento++) {
        await new Promise((ok) => setTimeout(ok, 700 * intento));
        r = await renovarSesion();
      }
      if (vivo) setUser((r?.user as PublicUser | undefined) ?? null);
    })().finally(() => {
      if (vivo) setLoading(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    tokenStore.set(result.accessToken);
    // Lo que se recordaba de las vistas era de la sesión anterior.
    viewCache.clear();
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
    viewCache.clear();
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
