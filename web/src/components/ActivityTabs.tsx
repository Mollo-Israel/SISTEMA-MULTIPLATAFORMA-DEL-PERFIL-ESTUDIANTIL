import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActivityManager from './ActivityManager';
import { useConfirm } from './feedback';
import { Tabs } from './ui';

export type VistaActividades = 'academica' | 'extracurricular' | 'externa';

const ETIQUETA: Record<VistaActividades, string> = {
  academica: 'Académicas',
  extracurricular: 'Extracurriculares',
  externa: 'Externas',
};

/**
 * V5 §5.1 (V5-10): tres pestañas estables —Académicas, Extracurriculares y
 * Externas—, cada una con su lista y su formulario tipado. El origen lo da la
 * pestaña: no hay un selector dentro del formulario que mezcle campos de una
 * externa en una interna. Las tres siguen siendo la misma tabla.
 *
 * Al cambiar de pestaña con un formulario abierto se confirma antes de
 * descartarlo: nunca se vacía en silencio.
 */
export default function ActivityTabs({
  vistas,
  soloSeguimiento = [],
  tipoDeExternas = 'academica',
}: {
  /** Pestañas que ve el rol, en orden (§5.3). */
  vistas: VistaActividades[];
  /** Pestañas en las que el rol da seguimiento pero no crea (Dirección en extracurriculares). */
  soloSeguimiento?: VistaActividades[];
  /** Tipo con el que el rol crea sus oportunidades externas. */
  tipoDeExternas?: 'academica' | 'extracurricular';
}) {
  const [params, setParams] = useSearchParams();
  const confirm = useConfirm();
  const abierto = useRef(false);
  const pedida = params.get('vista') as VistaActividades | null;
  const vista: VistaActividades = pedida && vistas.includes(pedida) ? pedida : vistas[0];
  const alAbrir = useCallback((v: boolean) => { abierto.current = v; }, []);

  const cambiar = async (k: string) => {
    if (k === vista) return;
    if (abierto.current) {
      const ok = await confirm({
        title: 'Tienes un formulario abierto',
        message: 'Si cambias de pestaña se descartan los cambios que no guardaste. Guárdalos como borrador si quieres conservarlos.',
        confirmLabel: 'Descartar y cambiar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    abierto.current = false;
    const resto = new URLSearchParams(params);
    if (k === vistas[0]) resto.delete('vista');
    else resto.set('vista', k);
    setParams(resto, { replace: true });
  };

  return (
    <>
      {vistas.length > 1 && (
        <Tabs items={vistas.map((v) => ({ key: v, label: ETIQUETA[v] }))} value={vista} onChange={(k) => void cambiar(k)} />
      )}
      <ActivityManager
        key={vista}
        activityType={vista === 'externa' ? tipoDeExternas : vista}
        filtroOrigen={vista === 'externa' ? 'external' : 'internal'}
        puedeCrear={!soloSeguimiento.includes(vista)}
        onFormularioAbierto={alAbrir}
      />
    </>
  );
}
