import { useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiPlay } from 'react-icons/fi';
import { apiError } from '../api/client';
import { projectService } from '../services';
import type { ProjectReadiness as Readiness } from '../services/types';
import { Button } from './ui';
import { useToast } from './feedback';

/**
 * Requisitos de V3 §22 en el orden en que se cumplen. V7.1 §8.1 (PROY-01): es
 * espejo de `PROJECT_READINESS_ROWS` (shared). Cada código que devuelve la
 * API pertenece a una fila: ninguna falta puede quedar oculta tras un verde.
 */
const REQUISITOS: { code: string; label: string; codes: string[] }[] = [
  { code: 'title', label: 'Título', codes: ['title'] },
  { code: 'area', label: 'Al menos un área', codes: ['area'] },
  { code: 'skill', label: 'Al menos una tecnología del catálogo', codes: ['skill'] },
  { code: 'skill_per_area', label: 'Cada área con al menos una tecnología usada en ella', codes: ['skill_per_area'] },
  { code: 'repository', label: 'Repositorio público y válido', codes: ['repository', 'repository_invalid', 'repository_not_public'] },
  { code: 'members_pending', label: 'Invitaciones respondidas', codes: ['members_pending'] },
  { code: 'members_unconfirmed', label: 'Integrantes con su contribución confirmada', codes: ['members_unconfirmed'] },
  { code: 'own_contribution', label: 'Tu contribución confirmada', codes: ['own_contribution'] },
  { code: 'evidence', label: 'Evidencia del funcionamiento o demo accesible', codes: ['evidence'] },
];
const GRUPO: Record<string, string> = Object.fromEntries(REQUISITOS.flatMap((q) => q.codes.map((c) => [c, q.code])));

/**
 * Qué le falta a un borrador para pasar a ACTIVE (V3 §22), y el botón para
 * activarlo cuando ya cumple. El servidor vuelve a comprobarlo todo: esto
 * solo lo hace visible.
 */
export default function ProjectReadiness({
  projectId,
  canActivate,
  onActivated,
  refreshKey,
}: Readonly<{
  projectId: string;
  canActivate: boolean;
  onActivated: () => void;
  /** V7.1 §8.1 (PROY-02): cambia cuando cambia el proyecto; la lista se vuelve a pedir. */
  refreshKey?: string;
}>) {
  const [r, setR] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const cargar = () => projectService.readiness(projectId).then(setR).catch(() => setR(null));
  useEffect(() => { cargar(); }, [projectId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return null;
  const faltan = new Map(r.missing.map((m) => [GRUPO[m.code] ?? m.code, m.message]));
  // Un código que esta interfaz todavía no conoce se muestra igual, en su propia fila.
  const desconocidos = r.missing.filter((m) => !GRUPO[m.code]);

  const activar = async () => {
    setBusy(true);
    try {
      await projectService.update(projectId, { status: 'active' });
      toast.success('Proyecto activo', 'Ya forma parte de tu trayectoria.');
      onActivated();
    } catch (e) {
      toast.error(apiError(e));
      cargar();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="readiness mt">
      <strong>Para activarlo</strong>
      <ul className="readiness-list">
        {REQUISITOS.map((q) => {
          const falta = faltan.get(q.code);
          return (
            <li key={q.code} className={falta ? 'falta' : 'ok'}>
              {falta ? <FiAlertCircle size={13} aria-hidden /> : <FiCheckCircle size={13} aria-hidden />}{' '}
              <span>{q.label}</span>
              {falta && <span className="muted"> · {falta}</span>}
            </li>
          );
        })}
        {desconocidos.map((m) => (
          <li key={m.code} className="falta">
            <FiAlertCircle size={13} aria-hidden /> <span>{m.message}</span>
          </li>
        ))}
      </ul>
      {r.warnings.map((w) => <p key={w} className="muted small">{w}</p>)}
      {canActivate && (
        <Button size="sm" disabled={!r.ready} loading={busy} onClick={activar} icon={<FiPlay size={13} />}>
          Activar proyecto
        </Button>
      )}
    </div>
  );
}
