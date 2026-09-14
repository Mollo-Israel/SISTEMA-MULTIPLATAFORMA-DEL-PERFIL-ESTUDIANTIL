import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX, FiXCircle } from 'react-icons/fi';
import { requestActivity } from '../api/client';

/**
 * Piezas transversales de experiencia de usuario.
 *
 * No cambian ninguna funcionalidad: sustituyen la forma de avisar. Antes cada
 * pantalla guardaba su propio mensaje en un estado y lo pintaba como un aviso
 * fijo que empujaba el contenido; las confirmaciones usaban el cuadro del
 * navegador, que no se puede dar estilo ni traducir.
 *
 * Aqui viven tres cosas:
 *  - las notificaciones flotantes (avisos que no mueven la pagina);
 *  - el dialogo de confirmacion, que devuelve una promesa y reemplaza uno a uno
 *    a window.confirm;
 *  - la barra de progreso superior, que se alimenta de las peticiones en curso.
 */

// ===========================================================================
//  Notificaciones
// ===========================================================================

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  description?: string;
}

interface ToastApi {
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_ICON = {
  success: FiCheckCircle,
  error: FiXCircle,
  info: FiInfo,
};

/** Cuanto permanece visible cada aviso. Los errores duran mas: hay que leerlos. */
const DURATION: Record<ToastTone, number> = {
  success: 3600,
  info: 4200,
  error: 6500,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, description?: string) => {
      const id = nextId.current++;
      // Se limita la pila: mas de cuatro avisos a la vez no se alcanzan a leer.
      setItems((prev) => [...prev.slice(-3), { id, tone, message, description }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[tone]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, description) => push('success', message, description),
      error: (message, description) => push('error', message, description),
      info: (message, description) => push('info', message, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = TONE_ICON[item.tone];
            return (
              <motion.div
                key={item.id}
                className={`toast toast-${item.tone}`}
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                layout
              >
                <Icon className="toast-icon" size={18} />
                <div className="toast-body">
                  <strong>{item.message}</strong>
                  {item.description && <span>{item.description}</span>}
                </div>
                <button
                  type="button"
                  className="toast-close"
                  onClick={() => dismiss(item.id)}
                  aria-label="Cerrar aviso"
                >
                  <FiX size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Notificaciones flotantes. Si no hay proveedor montado devuelve una version
 * inerte, para que una pantalla nunca se rompa por un aviso.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? { success: () => {}, error: () => {}, info: () => {} };
}

// ===========================================================================
//  Confirmacion
// ===========================================================================

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" para acciones que borran o desactivan. */
  tone?: 'danger' | 'default';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);
  const acceptRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      pending?.resolve(value);
      setPending(null);
    },
    [pending],
  );

  // Escape cancela, como en cualquier dialogo del sistema.
  useEffect(() => {
    if (!pending) return;
    acceptRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
          >
            <motion.div
              className="modal confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-label={pending.options.title}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-head">
                <div className={`confirm-icon ${pending.options.tone === 'danger' ? 'danger' : ''}`}>
                  <FiAlertTriangle size={20} />
                </div>
                <div>
                  <h3>{pending.options.title}</h3>
                  {pending.options.message && (
                    <div className="muted">{pending.options.message}</div>
                  )}
                </div>
              </div>
              <div className="confirm-actions">
                <button type="button" className="btn btn-secondary" onClick={() => close(false)}>
                  {pending.options.cancelLabel ?? 'Cancelar'}
                </button>
                <button
                  type="button"
                  ref={acceptRef}
                  className={`btn ${pending.options.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => close(true)}
                >
                  {pending.options.confirmLabel ?? 'Continuar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

/**
 * Confirmacion con estilo propio. Reemplaza a window.confirm sin cambiar la
 * logica: sigue devolviendo true o false, solo que como promesa.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  // Sin proveedor se cae al dialogo del navegador: nunca se pierde la pregunta.
  return ctx ?? (async (options) => window.confirm(options.title));
}

// ===========================================================================
//  Barra de progreso superior
// ===========================================================================

/**
 * Indica que hay peticiones en curso. Se alimenta del contador del cliente
 * HTTP, asi que refleja actividad real y no una animacion decorativa.
 *
 * Espera un instante antes de aparecer: si la respuesta llega rapido, un
 * parpadeo molesta mas de lo que informa.
 */
export function TopProgress() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = requestActivity.subscribe((pending) => {
      if (pending > 0) {
        if (!timer) timer = setTimeout(() => setVisible(true), 180);
      } else {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        setVisible(false);
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="top-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          aria-hidden="true"
        >
          <span />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
