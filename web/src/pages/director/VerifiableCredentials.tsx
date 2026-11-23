import { useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiExternalLink, FiPauseCircle, FiPlayCircle, FiShield, FiSlash, FiToggleLeft, FiToggleRight, FiXCircle } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../auth/AuthContext';
import { RolNombre } from '../../constants';
import { AsyncView, Badge, Button, Card, EmptyState, Modal, PageHeader, SearchInput, Stat } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { credentialService, ESTADO_REGISTRO } from '../../services/credentials';
import type { IntegrityReport, LedgerEvent, VerifiableCredentialItem } from '../../services/credentials';

const fecha = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-BO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const EVENTO: Record<string, string> = {
  ISSUED: 'Firmado y sellado', SUSPENDED: 'Suspendido', SUSPENSION_LIFTED: 'Suspensión levantada', REVOKED: 'Revocado',
};

type Accion = { tipo: 'suspend' | 'lift' | 'revoke'; item: VerifiableCredentialItem };

const TEXTO_ACCION: Record<Accion['tipo'], { titulo: string; boton: string; ayuda: string }> = {
  suspend: { titulo: 'Suspender registro', boton: 'Suspender', ayuda: 'Mientras esté suspendido, quien lo verifique verá «suspendido». Se puede levantar después.' },
  lift: { titulo: 'Levantar suspensión', boton: 'Levantar', ayuda: 'El registro vuelve a verificarse como vigente, si el hecho de origen sigue vigente.' },
  revoke: { titulo: 'Revocar registro', boton: 'Revocar definitivamente', ayuda: 'La revocación es definitiva: ni la base de datos permite deshacerla. Quedará publicada en la lista de revocación firmada.' },
};

/**
 * V8 · Registros verificables, vista de Dirección.
 *
 * Aquí se decide la política que V5 dejó pendiente (ND-01), se suspende o
 * revoca con motivo y se audita la integridad de todo lo firmado.
 * Administración entra en modo lectura: consulta y audita, no decide.
 */
export default function DirectorVerifiableCredentialsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const esDireccion = user?.role === RolNombre.CAREER_DIRECTOR;
  const politica = useAsync(() => credentialService.policy(), []);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const registro = useAsync(() => credentialService.registry({ q, status: estado || undefined, limit: 100 }), [q, estado]);
  const [cambioPolitica, setCambioPolitica] = useState(false);
  const [justificacion, setJustificacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState<(VerifiableCredentialItem & { ledger: LedgerEvent[] }) | null>(null);
  const [integridad, setIntegridad] = useState<IntegrityReport | null>(null);
  const [auditando, setAuditando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);

  const cambiarPolitica = async () => {
    if (!politica.data) return;
    setGuardando(true);
    try {
      await credentialService.setPolicy(!politica.data.enabled, justificacion);
      toast.success(politica.data.enabled ? 'La emisión quedó apagada.' : 'La emisión quedó habilitada.');
      setCambioPolitica(false);
      setJustificacion('');
      politica.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  const ejecutarAccion = async () => {
    if (!accion) return;
    setGuardando(true);
    try {
      const fn = accion.tipo === 'suspend' ? credentialService.suspend : accion.tipo === 'lift' ? credentialService.lift : credentialService.revoke;
      await fn(accion.item.id, motivo);
      toast.success('Listo. El cambio ya se refleja en la verificación pública.');
      setAccion(null);
      setMotivo('');
      registro.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  const auditar = async () => {
    setAuditando(true);
    try {
      setIntegridad(await credentialService.integrity());
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setAuditando(false);
    }
  };

  const emitirPendientes = async () => {
    setEmitiendo(true);
    try {
      const r = await credentialService.issuePending();
      toast.success(`Se firmaron ${r.issued} registros de ${r.students} estudiantes.`);
      registro.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEmitiendo(false);
    }
  };

  const verDetalle = async (id: string) => {
    try {
      setDetalle(await credentialService.detail(id));
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Registros verificables"
        description="Participaciones y entregas firmadas digitalmente (Open Badges 3.0 y 2.0). Cualquiera las comprueba en la página pública de verificación, sin cuenta."
        actions={<a className="btn btn-secondary" href="/verificar" target="_blank" rel="noreferrer"><FiExternalLink /> Página de verificación</a>}
      />

      <AsyncView loading={politica.loading} error={politica.error} data={politica.data}>
        {(p) => (
          <Card title="Política de emisión (V5 · ND-01)">
            <div className="vc-politica">
              <div>
                <div className="flex">
                  {p.enabled ? <Badge tone="green"><FiCheckCircle /> Habilitada</Badge> : <Badge tone="gray"><FiSlash /> Apagada</Badge>}
                  {!p.configured && <Badge tone="amber"><FiAlertTriangle /> Falta CREDENTIALS_PUBLIC_API_URL</Badge>}
                </div>
                <p className="muted small" style={{ margin: '0.4rem 0 0' }}>
                  {p.decidedAt
                    ? <>Decidido por {p.decidedBy ?? 'Dirección'} el {fecha(p.decidedAt)}: «{p.justification}»</>
                    : 'Dirección aún no decidió. Sin decisión, Afinia no firma nada nuevo (V5 §1.2).'}
                </p>
              </div>
              {esDireccion && (
                <div className="flex" style={{ flexWrap: 'wrap' }}>
                  {p.enabled && <Button variant="secondary" loading={emitiendo} icon={<FiShield />} onClick={emitirPendientes}>Firmar lo pendiente</Button>}
                  <Button variant={p.enabled ? 'secondary' : 'primary'} icon={p.enabled ? <FiToggleLeft /> : <FiToggleRight />} onClick={() => setCambioPolitica(true)}>
                    {p.enabled ? 'Apagar la emisión' : 'Habilitar la emisión'}
                  </Button>
                </div>
              )}
            </div>
            {p.history.length > 1 && (
              <details className="vc-tecnico mt">
                <summary>Historia de decisiones ({p.history.length})</summary>
                <ul>{p.history.map((h) => <li key={h.decidedAt}>{fecha(h.decidedAt)} · {h.enabled ? 'habilitó' : 'apagó'} · {h.decidedBy ?? '—'} · «{h.justification}»</li>)}</ul>
              </details>
            )}
          </Card>
        )}
      </AsyncView>

      {registro.data && (
        <div className="grid cols-4 mt">
          <Stat value={registro.data.summary.total} label="Registros firmados" />
          <Stat value={registro.data.summary.suspendidos} label="Suspendidos" />
          <Stat value={registro.data.summary.revocados} label="Revocados" />
          <Stat value={integridad ? (integridad.ok ? 'Íntegra' : 'Con problemas') : '—'} label="Bitácora" />
        </div>
      )}

      <Card
        title="Integridad"
        actions={<Button variant="secondary" loading={auditando} icon={<FiShield />} onClick={auditar}>Auditar ahora</Button>}
      >
        {!integridad && (
          <p className="muted" style={{ margin: 0 }}>
            Recorre la bitácora encadenada entera y comprueba, registro por registro, la firma digital, la huella y el sello de emisión.
          </p>
        )}
        {integridad && (
          <div className={`vc-resultado ${integridad.ok ? 'vc-ok' : 'vc-mal'}`}>
            <span className="vc-icono">{integridad.ok ? <FiCheckCircle size={28} /> : <FiXCircle size={28} />}</span>
            <div>
              <h2 style={{ fontSize: '1.05rem' }}>{integridad.ok ? 'Todo está íntegro' : 'Se encontraron problemas'}</h2>
              <p className="small">
                {integridad.ledger.entries} entradas en la bitácora · {integridad.credentialsChecked} registros comprobados
                {integridad.ledger.head && <> · cabeza n.º {integridad.ledger.head.seq} <span className="vc-mono">{integridad.ledger.head.hash.slice(0, 20)}…</span></>}
              </p>
              {integridad.ledger.brokenAt && <p className="small">Cadena rota en n.º {integridad.ledger.brokenAt.seq}: {integridad.ledger.brokenAt.reason}</p>}
              {integridad.problems.slice(0, 10).map((x) => <p key={`${x.code}-${x.problem}`} className="small">{x.code}: {x.problem}</p>)}
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Registro"
        actions={
          <div className="flex" style={{ flexWrap: 'wrap' }}>
            <select aria-label="Filtrar por estado" style={{ width: "auto" }} value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="active">Vigentes</option>
              <option value="without_effect">Sin efecto</option>
              <option value="suspended">Suspendidos</option>
              <option value="revoked">Revocados</option>
            </select>
            <SearchInput value={q} onChange={setQ} placeholder="Titular, logro o código…" />
          </div>
        }
      >
        <AsyncView
          loading={registro.loading}
          error={registro.error}
          data={registro.data}
          isEmpty={(d) => d.items.length === 0}
          empty={<EmptyState message="Todavía no hay registros firmados con estos filtros." />}
        >
          {(d) => (
            <div className="table-scroll">
              <table className="tabla-apilable">
                <thead><tr><th>Código</th><th>Titular</th><th>Logro</th><th>Firmado</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {d.items.map((i) => {
                    const est = ESTADO_REGISTRO[i.status];
                    return (
                      <tr key={i.id}>
                        <td className="vc-mono"><button type="button" className="btn btn-ghost btn-sm" onClick={() => verDetalle(i.id)}>{i.code}</button></td>
                        <td>{i.holderName}</td>
                        <td>{i.achievementName}<div className="muted small">{i.sourceLabel}</div></td>
                        <td>{fecha(i.issuedAt)}</td>
                        <td><Badge tone={est.tone}>{est.label}</Badge></td>
                        <td>
                          {esDireccion && i.status !== 'revoked' && (
                            <div className="flex" style={{ gap: '0.3rem', flexWrap: 'wrap' }}>
                              {i.status === 'suspended'
                                ? <Button size="sm" variant="secondary" icon={<FiPlayCircle />} onClick={() => setAccion({ tipo: 'lift', item: i })}>Levantar</Button>
                                : <Button size="sm" variant="secondary" icon={<FiPauseCircle />} onClick={() => setAccion({ tipo: 'suspend', item: i })}>Suspender</Button>}
                              <Button size="sm" variant="ghost" icon={<FiSlash />} onClick={() => setAccion({ tipo: 'revoke', item: i })}>Revocar</Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>

      {cambioPolitica && politica.data && (
        <Modal
          title={politica.data.enabled ? 'Apagar la emisión' : 'Habilitar la emisión'}
          subtitle="Queda en la historia, en la auditoría y sellado en la bitácora."
          onClose={() => setCambioPolitica(false)}
          width={520}
        >
          <p className="muted small" style={{ marginTop: 0 }}>
            {politica.data.enabled
              ? 'No se firmará nada nuevo. Lo ya emitido se sigue verificando.'
              : 'Afinia firmará registros de participación confirmada y de entregas de certificados institucionales. No son certificados académicos.'}
          </p>
          <label className="field">
            <span>Justificación</span>
            <textarea rows={3} maxLength={500} value={justificacion} onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Por ejemplo: aprobado en reunión de carrera del 18/11/2026." />
          </label>
          <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setCambioPolitica(false)}>Cancelar</Button>
            <Button loading={guardando} disabled={justificacion.trim().length < 10} onClick={cambiarPolitica}>Confirmar</Button>
          </div>
        </Modal>
      )}

      {accion && (
        <Modal title={TEXTO_ACCION[accion.tipo].titulo} subtitle={`${accion.item.code} · ${accion.item.holderName}`} onClose={() => setAccion(null)} width={520}>
          <p className="muted small" style={{ marginTop: 0 }}>{TEXTO_ACCION[accion.tipo].ayuda}</p>
          <label className="field">
            <span>Motivo (lo ve el titular; no se publica)</span>
            <textarea rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </label>
          <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setAccion(null)}>Cancelar</Button>
            <Button variant={accion.tipo === 'revoke' ? 'danger' : 'primary'} loading={guardando} disabled={motivo.trim().length < 10} onClick={ejecutarAccion}>
              {TEXTO_ACCION[accion.tipo].boton}
            </Button>
          </div>
        </Modal>
      )}

      {detalle && (
        <Modal title={detalle.achievementName} subtitle={`${detalle.code} · ${detalle.holderName}`} onClose={() => setDetalle(null)} width={620}>
          <dl className="vc-datos">
            <div><dt>Estado</dt><dd><Badge tone={ESTADO_REGISTRO[detalle.status].tone}>{ESTADO_REGISTRO[detalle.status].label}</Badge></dd></div>
            <div><dt>Tipo</dt><dd>{detalle.sourceLabel}</dd></div>
            <div><dt>Firmado</dt><dd>{fecha(detalle.issuedAt)}</dd></div>
            <div><dt>Clave</dt><dd className="vc-mono small">{detalle.keyId}</dd></div>
            {detalle.documentIssuer && <div><dt>Emisor del certificado</dt><dd>{detalle.documentIssuer}</dd></div>}
            {detalle.revocationReason && <div><dt>Motivo de revocación</dt><dd>{detalle.revocationReason} ({detalle.revokedBy ?? '—'})</dd></div>}
            {detalle.suspensionReason && <div><dt>Motivo de suspensión</dt><dd>{detalle.suspensionReason} ({detalle.suspendedBy ?? '—'})</dd></div>}
          </dl>
          <h4 className="mt" style={{ marginBottom: '0.4rem' }}>Bitácora</h4>
          <div className="vc-cadena">
            {detalle.ledger.map((e) => (
              <div className="vc-eslabon" key={e.seq}>
                <FiShield /><strong>n.º {e.seq}</strong><span>{EVENTO[e.event] ?? e.event}</span>
                <span className="muted small">{fecha(e.createdAt)}</span>
                <span className="vc-mono">{e.entryHash.slice(0, 20)}…</span>
              </div>
            ))}
          </div>
          <div className="flex mt" style={{ justifyContent: 'flex-end' }}>
            <a className="btn btn-secondary" href={detalle.verifyUrl} target="_blank" rel="noreferrer"><FiExternalLink /> Ver verificación pública</a>
          </div>
        </Modal>
      )}
    </div>
  );
}
