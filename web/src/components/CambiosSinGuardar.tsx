/**
 * V6 §4.4: no perder lo que la persona escribió al navegar.
 *
 * Un solo mecanismo para todos los formularios: cada uno avisa si tiene
 * cambios reales (`useCambiosSinGuardar(sucio)`) y este proveedor protege la
 * salida —enlaces internos del menú, cambiar de pestaña, cerrar el formulario
 * y recargar o cerrar la ventana— con el diálogo propio del sistema
 * («Continuar editando» / «Descartar cambios y salir»), nunca `window.confirm`.
 *
 * Límite conocido: el botón «Atrás» del navegador no se puede detener con
 * `BrowserRouter`; recargar o cerrar la pestaña muestra el aviso nativo del
 * navegador, que es el único que permiten.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from './feedback';

interface Api {
  marcar: (id: string, descartar: (() => void) | null) => void;
  /** true si se puede salir: no hay cambios, o la persona eligió descartarlos. */
  confirmarSalida: () => Promise<boolean>;
}

const Ctx = createContext<Api>({ marcar: () => {}, confirmarSalida: async () => true });

export function CambiosSinGuardarProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  /** Formularios con cambios, con lo que hace cada uno al descartarlos. */
  const sucios = useRef(new Map<string, () => void>());
  const preguntando = useRef<Promise<boolean> | null>(null);

  const marcar = useCallback((id: string, descartar: (() => void) | null) => {
    if (descartar) sucios.current.set(id, descartar);
    else sucios.current.delete(id);
  }, []);

  const confirmarSalida = useCallback(async () => {
    if (sucios.current.size === 0) return true;
    // Un solo diálogo aunque lleguen dos intentos de salir a la vez.
    preguntando.current ??= confirm({
      title: 'Tienes cambios sin guardar',
      message: 'Si sales ahora, se pierde lo que escribiste. Guárdalo como borrador si quieres conservarlo.',
      confirmLabel: 'Descartar cambios y salir',
      cancelLabel: 'Continuar editando',
      tone: 'danger',
    }).finally(() => { preguntando.current = null; });
    const ok = await preguntando.current;
    if (ok) {
      const descartes = [...sucios.current.values()];
      sucios.current.clear();
      descartes.forEach((d) => d());
    }
    return ok;
  }, [confirm]);

  // Enlaces internos (menú, migas, tarjetas): se interceptan antes que el router.
  useEffect(() => {
    const alHacerClic = (e: MouseEvent) => {
      if (sucios.current.size === 0 || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const enlace = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!enlace || (enlace.target && enlace.target !== '_self') || enlace.hasAttribute('download')) return;
      const destino = new URL(enlace.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      const ruta = `${destino.pathname}${destino.search}${destino.hash}`;
      if (ruta === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmarSalida().then((ok) => { if (ok) navigate(ruta); });
    };
    document.addEventListener('click', alHacerClic, true);
    return () => document.removeEventListener('click', alHacerClic, true);
  }, [confirmarSalida, navigate]);

  // Recargar o cerrar la ventana: el navegador solo permite su aviso nativo.
  useEffect(() => {
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      if (sucios.current.size === 0) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', antesDeSalir);
    return () => window.removeEventListener('beforeunload', antesDeSalir);
  }, []);

  const api = useMemo(() => ({ marcar, confirmarSalida }), [marcar, confirmarSalida]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/**
 * Registra un formulario. `sucio` = tiene cambios reales respecto de lo que
 * se cargó; `descartar` limpia su estado cuando la persona elige salir.
 */
export function useCambiosSinGuardar(sucio: boolean, descartar: () => void) {
  const { marcar, confirmarSalida } = useContext(Ctx);
  const id = useId();
  const ultimo = useRef(descartar);
  ultimo.current = descartar;
  useEffect(() => {
    marcar(id, sucio ? () => ultimo.current() : null);
  }, [id, sucio, marcar]);
  useEffect(() => () => marcar(id, null), [id, marcar]);
  return { confirmarSalida };
}

/** Para quien no edita nada pero puede sacar a la persona de un formulario (pestañas). */
export function useConfirmarSalida() {
  return useContext(Ctx).confirmarSalida;
}
