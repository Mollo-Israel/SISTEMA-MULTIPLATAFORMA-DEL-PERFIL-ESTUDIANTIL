import type { ReactNode } from 'react';

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      {(title || actions) && (
        <div className="card-header">
          {title ? <h3>{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="card stat">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="state">
      <div className="spinner" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="state error">⚠ {message}</div>;
}

export function EmptyState({ message = 'Sin datos para mostrar.' }: { message?: string }) {
  return <div className="state">{message}</div>;
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

interface AsyncViewProps<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  children: (data: T) => ReactNode;
}

export function AsyncView<T>({ loading, error, data, isEmpty, emptyMessage, children }: AsyncViewProps<T>) {
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState message={emptyMessage} />;
  if (isEmpty && isEmpty(data)) return <EmptyState message={emptyMessage} />;
  return <>{children(data)}</>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
