import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { HOME_BY_ROLE } from '../navigation';
import { Loading } from './ui';

export default function ProtectedRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Verificando sesión…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={HOME_BY_ROLE[user.role] ?? '/login'} replace />;
  }
  return <>{children}</>;
}
