import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import { authService, type PublicUser } from '../services';

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
    await tokenStore.setPair(result.accessToken, result.refreshToken);
    setUser(result.user);
  };

  /**
   * Cierra la sesión también en el servidor (§14).
   *
   * Si la llamada falla —sin red, por ejemplo— se limpia igualmente el
   * teléfono: el usuario pidió salir, y dejarlo dentro sería peor que perder
   * la revocación remota, que la caducidad del token resolverá sola.
   */
  const logout = async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // Silencioso a propósito: ver comentario anterior.
      }
    }
    await tokenStore.clear();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
