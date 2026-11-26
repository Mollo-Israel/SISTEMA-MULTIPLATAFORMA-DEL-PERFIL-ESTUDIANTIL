import { useEffect, useState } from 'react';
import { BotonArchivo } from '../../components/ArchivoProtegido';
import { FiAlertCircle, FiAward, FiCheck, FiFile, FiLink, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { manualReviewService } from '../../services';
import {
  Badge, Button, Card, Diferido, EmptyState, PageHeader, SkeletonTable, Stagger, Tabs,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import type { CredentialPhase, ManualReviewItem } from '../../services/types';
import { CREDENTIAL_CONTRADICTION_LABEL } from '../../services/types';

const METODOS: { value: string; label: string; independiente: boolean }[] = [
  { value: 'issuer_official_lookup', label: 'Consulté la página o el registro individual del emisor', independiente: true },
  { value: 'issuer_confirmation', label: 'El emisor lo confirmó por un canal propio (correo, nota oficial)', independiente: true },
  { value: 'institutional_registry', label: 'Lo respalda un registro institucional (acta, sistema académico)', independiente: true },
  { value: 'document_only', label: 'Revisé el documento y las fuentes aportadas, sin prueba externa', independiente: false },
];

type Estado = 'pendientes' | 'observadas' | 'decididas' | 'todas';
type Decision = 'corroborated' | 'approved' | 'observed' | 'rejected';

const TONO_REVISION: Record<string, string> = {
  requested: 'amber', observed: 'amber', corroborated: 'green', approved: 'green', rejected: 'red', inconclusive: 'gray', not_corroborated: 'gray',
};
const ESTADO_FASE: Record<CredentialPhase['estado'], string> = {
  no_aplica: 'No aplica', omitida: 'Omitida', pendiente: 'Pendiente', procesando: 'Comprobando', completada: 'Con resultado',
  inconclusa: 'Inconclusa', error: 'Error técnico', sin_solicitud: 'Sin solicitud', decidida: 'Decidida', observada: 'Observada',
};
const ORIGEN = { opportunity: 'De una oportunidad', historical_external: 'Histórica (antes o fuera de Afinia)' };

/**
 * V7.1 §5.3 fase 3 (D01) · Revisión de credenciales externas.
 *
 * Toda credencial presentada llega aquí, las pendientes primero. Decide
 * **solo Dirección**: aprobar con una prueba externa independiente (respaldo
 * corroborado), aprobar revisando el documento (respaldo parcial), observar
 * para que el estudiante la corrija, o rechazar con motivo. Las comprobaciones
 * automáticas son ayuda: ninguna aprueba sola. Administración consulta en
 * solo lectura. Aprobar no es certificar la autenticidad del documento.
 */
export default function CredentialReviewsPage() {
  const { user } = useAuth();
  const soloLectura = user?.role !== 'CAREER_DIRECTOR';
  const [estado, setEstado] = useState<Estado>('pendientes');
  const [items, setItems] = useState<ManualReviewItem[] | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [metodo, setMetodo] = useState('');
  const [prueba, setPrueba] = useState('');
  const [busy, setBusy] = useState(false);
  const independiente = METODOS.find((m) => m.value === metodo)?.independiente ?? false;
  const limpiar = () => { setAbierto(null); setMotivo(''); setMetodo(''); setPrueba(''); };
  const toast = useToast();

  const cargar = (e: Estado = estado) => {
    setItems(null);
    return manualReviewService.pending(e).then(setItems).catch((err) => setError(apiError(err)));
  };
  useEffect(() => { void cargar(estado); }, [estado]); // eslint-disable-line react-hooks/exhaustive-deps

  const decidir = async (item: ManualReviewItem, decision: Decision) => {
    setBusy(true);
    try {
      await manualReviewService.decide(item.certificateId, {
        decision, reason: motivo.trim(), method: metodo || undefined, proof: prueba.trim() || undefined,
      });
      const titulo = {
        corroborated: 'Aprobada con prueba externa.', approved: 'Aprobada revisando el documento.',
        observed: 'Observada: el estudiante la corregirá.', rejected: 'Credencial rechazada.',
      }[decision];
      toast.success(titulo, item.studentName);
      limpiar();
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Revisión de credenciales"
        description="Todas las credenciales externas que presentan los estudiantes. Las comprobaciones automáticas son ayuda: la decisión es de Dirección. Aprobar no certifica la autenticidad del documento; dice con qué alcance se revisó."
      />
      {soloLectura && (
        <p className="inline-note" data-testid="revision-solo-lectura">
          Solo lectura: las credenciales las revisa y decide Dirección. Aquí puedes consultar en qué estado está cada una.
        </p>
      )}
      <Tabs
        items={[
          { key: 'pendientes', label: 'Pendientes' },
          { key: 'observadas', label: 'Observadas' },
          { key: 'decididas', label: 'Decididas' },
          { key: 'todas', label: 'Todas' },
        ]}
        value={estado}
        onChange={(k) => { limpiar(); setEstado(k as Estado); }}
      />
      {error && <p className="form-error">{error}</p>}
      {items === null ? (
        <Diferido><SkeletonTable rows={3} columns={4} /></Diferido>
      ) : <>{items.length === 0 ? (
        <EmptyState icon={<FiAward size={22} />} message={estado === 'pendientes' ? 'No hay credenciales esperando revisión.' : 'No hay credenciales en este estado.'} />
      ) : (
        <div className="grid" style={{ gap: '1rem' }}>
          {items.map((it, i) => (
            <Stagger key={it.certificateId} index={i}>
              <Card
                title={it.certificateName}
                actions={<span data-testid="estado-revision-item"><Badge tone={TONO_REVISION[it.reviewStatus] ?? 'gray'}>{it.validationStatus.label}</Badge></span>}
              >
                <p className="muted" style={{ marginTop: 0 }}>
                  {ORIGEN[it.source]}{it.activityTitle ? ` · ${it.activityTitle}` : ''}
                  {' · '}{it.issuer}{it.issueDate ? ` · ${it.issueDate}` : ''}{it.credentialId ? ` · código ${it.credentialId}` : ''}
                </p>
                <p style={{ margin: '0.3rem 0' }}>
                  <strong>{it.studentName}</strong>
                  {it.semester ? <span className="muted"> · {it.semester}.º semestre</span> : null}
                  {it.previousAttempts > 0 && <span className="muted"> · {it.previousAttempts} envío(s) anterior(es)</span>}
                </p>
                {(it.areas.length > 0 || it.skills.length > 0) && (
                  <p className="muted small" style={{ margin: '0.2rem 0' }}>
                    {it.areas.length > 0 && <>Áreas: {it.areas.join(', ')}. </>}
                    {it.skills.length > 0 && <>Tecnologías: {it.skills.join(', ')}.</>}
                  </p>
                )}
                {it.contradictions.length > 0 && (
                  <p className="respaldo-aviso" data-testid="discrepancias">
                    <FiAlertCircle /> {it.contradictions.map((c) => CREDENTIAL_CONTRADICTION_LABEL[c] ?? c).join('; ')}.
                  </p>
                )}
                {it.reviewReason && it.reviewStatus !== 'requested' && (
                  <p className="muted">Motivo de la decisión: «{it.reviewReason}»</p>
                )}
                <details className="fases-credencial">
                  <summary>Comprobaciones (ayuda para decidir)</summary>
                  <ol>
                    {it.phases.map((f) => (
                      <li key={f.fase}>
                        <strong>{f.fase}. {f.titulo}</strong> <Badge tone="gray">{ESTADO_FASE[f.estado]}</Badge>
                        <p>{f.resumen}</p>
                        {f.detalles.length > 0 && <ul>{f.detalles.map((d) => <li key={d}>{d}</li>)}</ul>}
                      </li>
                    ))}
                  </ol>
                </details>
                <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
                  {it.fileUrl && (
                    <BotonArchivo src={it.fileUrl} nombre="documento-credencial">
                      <FiFile /> Ver documento
                    </BotonArchivo>
                  )}
                  {it.certificateUrl && (
                    <a className="btn btn-secondary btn-sm" href={it.certificateUrl} target="_blank" rel="noreferrer noopener">
                      <FiLink /> Enlace declarado
                    </a>
                  )}
                </div>
                {!soloLectura && it.reviewStatus === 'requested' && (abierto === it.certificateId ? (
                  <div>
                    <div className="field">
                      <label htmlFor={`metodo-${it.certificateId}`}>Qué revisaste</label>
                      <select id={`metodo-${it.certificateId}`} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                        <option value="">Elige…</option>
                        {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    {independiente && (
                      <div className="field">
                        <label htmlFor={`prueba-${it.certificateId}`}>Prueba externa</label>
                        <input
                          id={`prueba-${it.certificateId}`}
                          value={prueba}
                          maxLength={500}
                          onChange={(e) => setPrueba(e.target.value)}
                          placeholder="Registro oficial individual o referencia (p. ej., correo de certificados@emisor.org del 12/10)"
                        />
                        <span className="field-hint">Independiente del propio archivo: la URL que trae el certificado no cuenta.</span>
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor={`motivo-${it.certificateId}`}>Motivo o detalle de la revisión</label>
                      <textarea
                        id={`motivo-${it.certificateId}`}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Ej.: consulté al emisor y confirmó el código y el nombre. Si la observas, di qué debe corregir."
                      />
                      <span className="field-hint">Obligatorio, al menos 20 caracteres. El estudiante lo ve y queda en la auditoría.</span>
                    </div>
                    <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Button size="sm" loading={busy} icon={<FiCheck size={14} />}
                        disabled={motivo.trim().length < 20 || !independiente || prueba.trim().length < 10}
                        onClick={() => decidir(it, 'corroborated')}>
                        Aprobar con prueba externa
                      </Button>
                      <Button size="sm" variant="secondary" loading={busy} icon={<FiCheck size={14} />}
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'approved')}>
                        Aprobar revisando el documento
                      </Button>
                      <Button size="sm" variant="secondary" loading={busy}
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'observed')}>
                        Observar (pedir corrección)
                      </Button>
                      <Button size="sm" variant="danger" loading={busy} icon={<FiX size={14} />}
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'rejected')}>
                        Rechazar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={limpiar}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => { limpiar(); setAbierto(it.certificateId); }}>
                    Revisar
                  </Button>
                ))}
              </Card>
            </Stagger>
          ))}
        </div>
      )}</>}
    </div>
  );
}
