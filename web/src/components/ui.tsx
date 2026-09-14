import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiInbox, FiSearch, FiX } from 'react-icons/fi';

/**
 * Componentes compartidos de la interfaz.
 *
 * Los que ya existian conservan su firma: las pantallas que los usan siguen
 * funcionando igual. Lo nuevo se agrega al lado -esqueletos de carga, botones
 * con estado, buscador, encabezado de pagina, pestañas y barra de progreso-
 * para que cada pantalla lo adopte sin reescribirse.
 */

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

/**
 * Estado vacio. Acepta un icono y una accion para que no sea un callejon sin
 * salida: decir "sin datos" y no ofrecer que hacer es media respuesta.
 */
export function EmptyState({
  message = 'Sin datos para mostrar.',
  icon,
  action,
}: {
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state empty-state">
      <div className="empty-icon">{icon ?? <FiInbox size={22} />}</div>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

// ===========================================================================
//  Esqueletos de carga
// ===========================================================================

/**
 * Bloque gris con brillo que ocupa el sitio del contenido mientras llega.
 * Evita el salto de la pagina que produce un indicador centrado.
 */
export function Skeleton({ width, height = 14, radius = 8 }: { width?: number | string; height?: number | string; radius?: number }) {
  return (
    <span
      className="skeleton"
      style={{ width: width ?? '100%', height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton key={c} width={c === 0 ? '28%' : undefined} height={12} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-cards" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="85%" height={11} />
          <Skeleton width="65%" height={11} />
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
//  Vista asincrona
// ===========================================================================

interface AsyncViewProps<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  isEmpty?: (data: T) => boolean;
  emptyMessage?: string;
  /** Contenido a mostrar mientras carga. Por defecto, el indicador de siempre. */
  skeleton?: ReactNode;
  emptyAction?: ReactNode;
  /** Vacio a medida. Sustituye por completo al EmptyState por defecto. */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function AsyncView<T>({
  loading,
  error,
  data,
  isEmpty,
  emptyMessage,
  skeleton,
  emptyAction,
  empty,
  children,
}: AsyncViewProps<T>) {
  const nothing = empty ?? <EmptyState message={emptyMessage} action={emptyAction} />;
  if (loading) return <>{skeleton ?? <Loading />}</>;
  if (error) return <ErrorState message={error} />;
  if (!data) return <>{nothing}</>;
  if (isEmpty && isEmpty(data)) return <>{nothing}</>;
  return <>{children(data)}</>;
}

// ===========================================================================
//  Modal
// ===========================================================================

/**
 * Dialogo centrado, con la misma entrada que el modal de confirmacion para que
 * todas las ventanas del sistema se sientan iguales. Escape y el fondo cierran.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  width,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          className="modal"
          style={width ? { maxWidth: width } : undefined}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          <div className="modal-head">
            <div>
              <h3>{title}</h3>
              {subtitle && <span className="muted">{subtitle}</span>}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Cerrar">
              <FiX />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

// ===========================================================================
//  Botones
// ===========================================================================

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  /** Muestra un indicador dentro del boton y lo deshabilita. */
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Boton con estado de carga. Evita el patron de cambiar el texto a mano
 * ("Guardando…") y, sobre todo, evita el doble envio: mientras carga no
 * responde.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${loading ? 'is-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  );
}

// ===========================================================================
//  Buscador
// ===========================================================================

/**
 * Campo de busqueda con icono y boton para limpiar.
 *
 * `onDebouncedChange` entrega el texto cuando el usuario deja de escribir, para
 * las pantallas que consultan al servidor en cada cambio.
 */
export function SearchInput({
  value,
  onChange,
  onDebouncedChange,
  placeholder = 'Buscar…',
  delay = 350,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onDebouncedChange?: (value: string) => void;
  placeholder?: string;
  delay?: number;
  autoFocus?: boolean;
}) {
  const callback = useRef(onDebouncedChange);
  callback.current = onDebouncedChange;

  useEffect(() => {
    if (!callback.current) return;
    const timer = setTimeout(() => callback.current?.(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="search-input">
      <FiSearch size={15} aria-hidden="true" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar búsqueda">
          <FiX size={14} />
        </button>
      )}
    </div>
  );
}

/** Cantidad de resultados tras filtrar. Da certeza de que el filtro se aplicó. */
export function ResultCount({ shown, total, noun = 'resultados' }: { shown: number; total: number; noun?: string }) {
  if (shown === total) return <span className="result-count">{total} {noun}</span>;
  return (
    <span className="result-count">
      {shown} de {total} {noun}
    </span>
  );
}

// ===========================================================================
//  Encabezado de pagina y pestañas
// ===========================================================================

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export interface TabItem {
  key: string;
  label: ReactNode;
  count?: number;
}

/** Pestañas con indicador animado, en lugar de botones sueltos. */
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  const id = useRef(`tabs-${Math.random().toString(36).slice(2)}`).current;
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            role="tab"
            aria-selected={active}
            className={`tab ${active ? 'on' : ''}`}
            onClick={() => onChange(item.key)}
            type="button"
          >
            <span>
              {item.label}
              {typeof item.count === 'number' && <em className="tab-count">{item.count}</em>}
            </span>
            {active && <motion.span layoutId={id} className="tab-underline" />}
          </button>
        );
      })}
    </div>
  );
}

// ===========================================================================
//  Progreso
// ===========================================================================

/** Barra de progreso con porcentaje animado. */
export function ProgressBar({
  value,
  label,
  tone = 'bordo',
}: {
  value: number;
  label?: string;
  tone?: 'bordo' | 'green' | 'amber';
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress-block">
      {(label || true) && (
        <div className="flex between progress-label">
          {label && <span>{label}</span>}
          <strong>{safe}%</strong>
        </div>
      )}
      <div className="progress" role="progressbar" aria-valuenow={safe} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className={`bar-${tone}`}
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}

/** Entrada escalonada para listas. Cada elemento aparece un poco después. */
export function Stagger({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.04 }}
    >
      {children}
    </motion.div>
  );
}

/** Copia un texto al portapapeles y avisa en el propio botón. */
export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copiado' : label}
    </button>
  );
}
