import { useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiPlay } from 'react-icons/fi';
import { apiError } from '../api/client';
import { projectService } from '../services';
import type { ProjectReadiness as Readiness } from '../services/types';
import { Button } from './ui';
import { useToast } from './feedback';

/** Todos los requisitos de V3 §22, en el orden en que se cumplen. */
const REQUISITOS: { code: string; label: string }[] = [
  { code: 'title', label: 'Título' },
  { code: 'area', label: 'Al menos un área' },
  { code: 'skill', label: 'Al menos una tecnología del catálogo' },
  { code: 'repository', label: 'Repositorio público y válido' },
  { code: 'members_pending', label: 'Invitaciones respondidas' },
  { code: 'members_unconfirmed', label: 'Integrantes con su contribución confirmada' },
  { code: 'own_contribution', label: 'Tu contribución confirmada' },
  { code: 'evidence', label: 'Evidencia del funcionamiento o demo accesible' },
];
const GRUPO: Record<string, string> = {
  repository_invalid: 'repository',
  repository_not_public: 'repository',
};

/**
 * Qué le falta a un borrador para pasar a ACTIVE (V3 §22), y el botón para
 * activarlo cuando ya cumple. El servidor vuelve a comprobarlo todo: esto
 * solo lo hace visible.
 */
export default function ProjectReadiness({
  projectId,
  canActivate,
  onActivated,
}: {
  projectId: string;
  canActivate: boolean;
  onActivated: () => void;
}) {
  const [r, setR] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const cargar = () => projectService.readiness(projectId).then(setR).catch(() => setR(null));
  useEffect(() => { cargar(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return null;
  const faltan = new Map(r.missing.map((m) => [GRUPO[m.code] ?? m.code, m.message]));

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
