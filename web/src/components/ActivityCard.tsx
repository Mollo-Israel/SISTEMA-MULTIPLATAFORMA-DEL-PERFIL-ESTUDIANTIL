import { ReactNode } from 'react';
import {
  FiAlertCircle, FiCalendar, FiCheckCircle, FiExternalLink, FiLink, FiMapPin, FiMonitor, FiTag, FiUsers, FiVideo,
} from 'react-icons/fi';
import type { Activity } from '../services/types';
import { Badge, Modal } from './ui';
import { formatearFechaHora } from '../lib/fechas';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, lbl } from '../constants';

const MODALIDAD: Record<string, string> = { presencial: 'Presencial', virtual: 'Virtual', hibrida: 'Híbrida' };

export const RESULTADO_LABEL: Record<string, string> = {
  none: 'Sin resultado',
  participation_only: 'La participación confirmada queda en tu trayectoria',
  internal_constancy: 'Constancia interna al confirmar tu participación',
  institution_issued_certificate: 'Certificado emitido por la institución',
  external_credential_expected: 'Credencial del proveedor, que acreditarás al terminar',
  other_authorized_resource: 'Otro recurso autorizado',
};

/** «Bases de Datos, Redes +2»: lo justo para que la tarjeta no crezca (V3.2 §37). */
export function resumen(nombres: string[], max = 2): string {
  if (nombres.length <= max) return nombres.join(', ');
  return `${nombres.slice(0, max).join(', ')} +${nombres.length - max}`;
}

const areasDe = (a: Activity) => {
  const todas = (a.activityAreas ?? []).map((x) => x.academicArea?.name).filter((x): x is string => !!x);
  return todas.length ? todas : a.academicArea?.name ? [a.academicArea.name] : [];
};
const skillsDe = (a: Activity) => (a.activitySkills ?? []).map((s) => s.skill?.name).filter((x): x is string => !!x);

function Rango({ a }: { a: Activity }) {
  if (!a.eventDate) return null;
  return (
    <span>
      <FiCalendar size={13} /> {formatearFechaHora(a.eventDate)}
      {a.endAt && <> – {formatearFechaHora(a.endAt, { day: undefined, month: undefined, year: undefined })}</>}
    </span>
  );
}

/**
 * Tarjeta de actividad de alto fijo (V3.2 §37): imagen, título, tipo, estado,
 * inicio y fin, áreas y habilidades resumidas, modalidad, enlace de reunión,
 * primer enlace útil, cupo y acciones. La descripción se trunca: lo completo
 * está en «Ver detalle».
 */
export function ActivityCard({
  a,
  onDetalle,
  aviso,
  acciones,
}: {
  a: Activity;
  onDetalle: () => void;
  aviso?: string | null;
  acciones?: ReactNode;
}) {
  const areas = areasDe(a);
  const skills = skillsDe(a);
  const primerEnlace = (a.resourceLinks ?? [])[0];
  return (
    <article className="activity-card">
      <div className="activity-card-img" aria-hidden>
        {a.imageUrl ? <img src={a.imageUrl} alt="" loading="lazy" /> : <FiCalendar size={28} />}
      </div>
      <div className="activity-card-body">
        <div className="activity-card-head">
          <h3 title={a.title}>{a.title}</h3>
          <Badge tone="bordo">{lbl(ACTIVITY_TYPE_LABEL, a.type)}</Badge>
        </div>
        <div className="activity-meta" style={{ marginTop: 0 }}>
          {a.originType === 'external' && <span className="badge-externa">Externa{a.provider ? ` · ${a.provider}` : ''}</span>}
          <span><FiCheckCircle size={13} /> {lbl(ACTIVITY_STATUS_LABEL, a.status)}</span>
          <span><FiTag size={13} /> {a.category?.name ?? 'Sin categoría'}</span>
        </div>
        {a.description && <p className="activity-card-desc">{a.description}</p>}
        <div className="activity-meta">
          <Rango a={a} />
          <span><FiMonitor size={13} /> {MODALIDAD[a.modality] ?? a.modality}</span>
          {a.location && <span><FiMapPin size={13} /> {a.location}</span>}
          {areas.length > 0 && <span title={areas.join(', ')}>Áreas: {resumen(areas)}</span>}
          {skills.length > 0 && <span title={skills.join(', ')}>Habilidades: {resumen(skills)}</span>}
          {a.capacity != null && (
            <span><FiUsers size={13} /> {a.seatsLeft != null ? `${a.seatsLeft} de ${a.capacity} lugares` : `Cupo ${a.capacity}`}</span>
          )}
          {a.meetingUrl && (
            <a href={a.meetingUrl} target="_blank" rel="noreferrer"><FiVideo size={13} /> Reunión</a>
          )}
          {primerEnlace && (
            <a href={primerEnlace.url} target="_blank" rel="noreferrer"><FiLink size={13} /> {primerEnlace.label}</a>
          )}
        </div>
        {a.status === 'cancelled' && a.cancellationReason && (
          <p className="inline-note"><FiAlertCircle size={13} /> Cancelada: {a.cancellationReason}</p>
        )}
        {aviso && a.status !== 'cancelled' && <p className="inline-note"><FiAlertCircle size={13} /> {aviso}</p>}
        <div className="activity-card-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDetalle}>Ver detalle</button>
          {acciones}
        </div>
      </div>
    </article>
  );
}

/** Detalle completo (V3.2 §37): todo lo que la tarjeta resume. */
export function ActivityDetail({ a, onClose, acciones }: { a: Activity; onClose: () => void; acciones?: ReactNode }) {
  const areas = areasDe(a);
  const skills = skillsDe(a);
  return (
    <Modal title={a.title} subtitle={`${lbl(ACTIVITY_TYPE_LABEL, a.type)} · ${lbl(ACTIVITY_STATUS_LABEL, a.status)}`} onClose={onClose} width={720}>
      {a.imageUrl && <img src={a.imageUrl} alt="" className="activity-detail-img" />}
      {a.status === 'cancelled' && a.cancellationReason && (
        <div className="form-alert" role="status"><FiAlertCircle size={15} /> <span>Cancelada: {a.cancellationReason}</span></div>
      )}
      {a.description && <p style={{ whiteSpace: 'pre-line' }}>{a.description}</p>}
      <dl className="detail-list">
        {a.eventDate && (<><dt>Inicio</dt><dd>{formatearFechaHora(a.eventDate)}</dd></>)}
        {a.endAt && (<><dt>Fin</dt><dd>{formatearFechaHora(a.endAt)}</dd></>)}
        <dt>Modalidad</dt><dd>{MODALIDAD[a.modality] ?? a.modality}</dd>
        {a.location && (<><dt>Aula o lugar</dt><dd>{a.location}</dd></>)}
        {a.meetingUrl && (<><dt>Reunión</dt><dd><a href={a.meetingUrl} target="_blank" rel="noreferrer">{a.meetingUrl}</a></dd></>)}
        {areas.length > 0 && (<><dt>Áreas</dt><dd>{areas.join(', ')}</dd></>)}
        {skills.length > 0 && (<><dt>Habilidades</dt><dd>{skills.join(', ')}</dd></>)}
        {(a.responsibles ?? []).length > 0 && (
          <><dt>Responsables</dt><dd>{(a.responsibles ?? []).map((p) => `${p.firstName} ${p.lastName}`).join(', ')}</dd></>
        )}
        {(a.contacts ?? []).length > 0 && (
          <>
            <dt>Contacto</dt>
            <dd>
              {(a.contacts ?? []).map((p) => (
                <div key={p.id}>{p.firstName} {p.lastName}{p.email && <> · <a href={`mailto:${p.email}`}>{p.email}</a></>}</div>
              ))}
            </dd>
          </>
        )}
        {a.capacity != null && (<><dt>Cupo</dt><dd>{a.seatsLeft != null ? `${a.seatsLeft} de ${a.capacity} lugares libres` : a.capacity}</dd></>)}
        {a.provider && (<><dt>Proveedor</dt><dd>{a.provider}</dd></>)}
        {a.externalUrl && (<><dt>Enlace oficial</dt><dd><a href={a.externalUrl} target="_blank" rel="noreferrer"><FiExternalLink size={13} /> {a.externalUrl}</a></dd></>)}
        {a.outcomePolicy && (<><dt>Al terminar</dt><dd>{RESULTADO_LABEL[a.outcomePolicy] ?? a.outcomePolicy}</dd></>)}
        {a.requirements && (<><dt>Requisitos</dt><dd>{a.requirements}</dd></>)}
      </dl>
      {(a.resourceLinks ?? []).length > 0 && (
        <>
          <h3 style={{ fontSize: '0.95rem' }}>Enlaces y recursos</h3>
          <ul className="links-list">
            {(a.resourceLinks ?? []).map((l) => (
              <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer"><FiLink size={13} /> {l.label}</a></li>
            ))}
          </ul>
        </>
      )}
      {acciones && <div className="form-actions" style={{ marginTop: '0.8rem' }}>{acciones}</div>}
    </Modal>
  );
}
