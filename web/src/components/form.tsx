import { ReactNode, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertCircle } from 'react-icons/fi';
import { formErrors } from '../api/client';

/**
 * Casilla de formulario con su etiqueta, su ayuda y su error.
 *
 * El error va debajo de la casilla que lo causa, no en un aviso general
 * arriba: quien rellena un formulario de seis campos necesita saber cuál está
 * mal, no solo que algo lo está.
 */
export function FormField({
  label,
  error,
  hint,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className ?? ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden> *</span>}
      </label>
      {children}
      <FieldError message={error} />
      {!error && hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

/** Mensaje de error de una casilla, con una entrada suave. */
export function FieldError({ message }: { message?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.span
          key={message}
          className="field-error"
          role="alert"
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <FiAlertCircle size={13} /> {message}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** Aviso general del formulario, para lo que no corresponde a una casilla. */
export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="form-alert" role="alert">
      <FiAlertCircle size={15} /> <span>{message}</span>
    </div>
  );
}

/**
 * Estado de errores de un formulario.
 *
 * `fromApi` reparte la respuesta de la API entre las casillas conocidas y el
 * aviso general; `clear` quita el error de una casilla en cuanto se corrige.
 */
export function useFormErrors<K extends string>(campos: readonly K[]) {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const [general, setGeneral] = useState<string | null>(null);

  const fromApi = useCallback(
    (error: unknown) => {
      const { general: g, fields } = formErrors(error, campos as unknown as string[]);
      setErrors(fields as Partial<Record<K, string>>);
      setGeneral(g);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campos.join('|')],
  );

  const clear = useCallback((campo: K) => {
    setErrors((prev) => {
      if (!prev[campo]) return prev;
      const next = { ...prev };
      delete next[campo];
      return next;
    });
    setGeneral(null);
  }, []);

  const reset = useCallback(() => {
    setErrors({});
    setGeneral(null);
  }, []);

  return { errors, setErrors, general, setGeneral, fromApi, clear, reset };
}

// ===========================================================================
//  V3 §67 · Validación por campo sin el mensaje nativo del navegador
// ===========================================================================

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Nombre del campo tal como lo ve la persona: su etiqueta asociada. */
function nombreDe(c: Control): string {
  const etiqueta = c.labels?.[0]?.textContent
    ?? (c.getAttribute('aria-labelledby') ? document.getElementById(c.getAttribute('aria-labelledby')!)?.textContent : null)
    ?? c.getAttribute('aria-label')
    ?? c.getAttribute('placeholder')
    ?? 'este campo';
  return etiqueta.replace(/\*/g, '').trim();
}

/** Un mensaje claro y específico, en lugar del globo del navegador. */
function mensajeDe(c: Control): string | null {
  const v = c.validity;
  if (v.valid) return null;
  const nombre = nombreDe(c);
  if (v.valueMissing) {
    return c instanceof HTMLSelectElement ? `Elige ${nombre.toLowerCase()}.` : `Completa «${nombre}».`;
  }
  if (v.typeMismatch && c.type === 'url') return 'Escribe un enlace completo, que empiece con https://.';
  if (v.typeMismatch && c.type === 'email') return 'Escribe un correo válido, por ejemplo nombre@univalle.edu.';
  if (v.tooShort) return `«${nombre}» necesita al menos ${(c as HTMLInputElement).minLength} caracteres.`;
  if (v.tooLong) return `«${nombre}» admite hasta ${(c as HTMLInputElement).maxLength} caracteres.`;
  if (v.rangeUnderflow) return `«${nombre}» debe ser al menos ${(c as HTMLInputElement).min}.`;
  if (v.rangeOverflow) return `«${nombre}» no puede pasar de ${(c as HTMLInputElement).max}.`;
  if (v.badInput || v.stepMismatch) return `Revisa el valor de «${nombre}».`;
  if (v.patternMismatch) return c.title || `Revisa el formato de «${nombre}».`;
  return `Revisa «${nombre}».`;
}

const MARCA = 'data-error-auto';

function limpiar(c: Control) {
  c.removeAttribute('aria-invalid');
  c.closest('.field')?.classList.remove('has-error');
  const previo = c.parentElement?.querySelector(`[${MARCA}="${c.id || c.name}"]`);
  previo?.remove();
}

/**
 * Valida un formulario con `noValidate` y deja el error debajo de cada campo
 * (V3 §67). Devuelve `true` si se puede enviar. El primer campo con error
 * recibe el foco, y cada error se borra en cuanto la persona lo corrige.
 */
export function validarFormulario(form: HTMLFormElement): boolean {
  const controles = Array.from(form.elements).filter(
    (e): e is Control => e instanceof HTMLInputElement || e instanceof HTMLSelectElement || e instanceof HTMLTextAreaElement,
  );
  let primero: Control | null = null;
  for (const c of controles) {
    limpiar(c);
    if (c.disabled || c.type === 'hidden') continue;
    const mensaje = mensajeDe(c);
    if (!mensaje) continue;
    primero ??= c;
    c.setAttribute('aria-invalid', 'true');
    c.closest('.field')?.classList.add('has-error');
    const span = document.createElement('span');
    span.className = 'field-error';
    span.setAttribute('role', 'alert');
    span.setAttribute(MARCA, c.id || c.name);
    span.textContent = mensaje;
    const id = `${c.id || c.name || 'campo'}-error`;
    span.id = id;
    c.setAttribute('aria-describedby', id);
    c.insertAdjacentElement('afterend', span);
    const alCorregir = () => {
      if (!mensajeDe(c)) {
        limpiar(c);
        c.removeEventListener('input', alCorregir);
        c.removeEventListener('change', alCorregir);
      }
    };
    c.addEventListener('input', alCorregir);
    c.addEventListener('change', alCorregir);
  }
  primero?.focus();
  return primero === null;
}
