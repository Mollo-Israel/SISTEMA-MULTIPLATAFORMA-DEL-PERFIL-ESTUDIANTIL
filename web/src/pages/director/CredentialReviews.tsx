import { useEffect, useState } from 'react';
import { BotonArchivo } from '../../components/ArchivoProtegido';
import { FiAward, FiCheck, FiFile, FiLink, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { manualReviewService } from '../../services';
import {
  Badge, Button, Card, Diferido, EmptyState, PageHeader, SkeletonTable, Stagger,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import type { ManualReviewItem } from '../../services/types';
import { CREDENTIAL_CHECK_LABEL } from '../../services/types';

const METODOS: { value: string; label: string; independiente: boolean }[] = [
  { value: 'issuer_official_lookup', label: 'Consulté la página o el registro individual del emisor', independiente: true },
  { value: 'issuer_confirmation', label: 'El emisor lo confirmó por un canal propio (correo, nota oficial)', independiente: true },
  { value: 'institutional_registry', label: 'Lo respalda un registro institucional (acta, sistema académico)', independiente: true },
  { value: 'document_only', label: 'Solo revisé el documento aportado', independiente: false },
];

/**
 * Revisión manual excepcional de credenciales históricas (V3 §16, §19).
 *
 * Solo para credenciales obtenidas antes o fuera de Afinia cuyo emisor no
 * ofrece un verificador digital que el sistema pueda consultar. V4.1 A41-018
 * (B32): verificarla exige una prueba externa independiente del archivo; si
 * solo se miró el documento, queda inconclusa. Todo queda auditado.
 */
export default function CredentialReviewsPage() {
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

  const cargar = () => manualReviewService.pending()
    .then(setItems)
    .catch((e) => setError(apiError(e)));
  useEffect(() => { cargar(); }, []);

  const decidir = async (item: ManualReviewItem, decision: 'corroborated' | 'inconclusive' | 'rejected') => {
    setBusy(true);
    try {
      await manualReviewService.decide(item.certificateId, {
        decision, reason: motivo.trim(), method: metodo || undefined, proof: prueba.trim() || undefined,
      });
      const titulo = { corroborated: 'Credencial verificada con prueba externa.', inconclusive: 'Revisión registrada: inconclusa.', rejected: 'Credencial rechazada.' }[decision];
      const detalle = { corroborated: 'ya cuenta como corroborada', inconclusive: 'no se afirma como verificada', rejected: 'queda señalada con tu motivo' }[decision];
      toast.success(titulo, `${item.studentName} · ${detalle}`);
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
        description="Credenciales históricas cuyo emisor no ofrece un verificador digital. Verificarla exige una prueba externa independiente del archivo; si solo puedes mirar el documento, márcala como inconclusa. Todo queda registrado."
      />
      {error && <p className="form-error">{error}</p>}
      {items === null ? (
        <Diferido><SkeletonTable rows={3} columns={4} /></Diferido>
      ) : items.length === 0 ? (
        <EmptyState icon={<FiAward size={22} />} message="No hay credenciales esperando revisión." />
      ) : (
        <div className="grid" style={{ gap: '1rem' }}>
          {items.map((it, i) => (
            <Stagger key={it.certificateId} index={i}>
              <Card
                title={it.certificateName}
                actions={<Badge tone="amber">{CREDENTIAL_CHECK_LABEL[it.credentialCheck ?? 'no_verifier']}</Badge>}
              >
                <p className="muted" style={{ marginTop: 0 }}>
                  {it.issuer}{it.issueDate ? ` · ${it.issueDate}` : ''}{it.credentialId ? ` · código ${it.credentialId}` : ''}
                </p>
                <p style={{ margin: '0.3rem 0' }}>
                  <strong>{it.studentName}</strong>
                  {it.semester ? <span className="muted"> · {it.semester}.º semestre</span> : null}
                </p>
                {it.requestNote && <p className="muted">«{it.requestNote}»</p>}
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
                {abierto === it.certificateId ? (
                  <div>
                    <div className="field">
                      <label htmlFor={`metodo-${it.certificateId}`}>Cómo lo comprobaste</label>
                      <select id={`metodo-${it.certificateId}`} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                        <option value="">Elige el método…</option>
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
                          placeholder="Enlace oficial individual o referencia (p. ej., correo de certificados@emisor.org del 12/10)"
                        />
                        <span className="field-hint">Independiente del propio archivo: la URL que trae el certificado no cuenta.</span>
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor={`motivo-${it.certificateId}`}>Detalle de la revisión</label>
                      <textarea
                        id={`motivo-${it.certificateId}`}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Ej.: consulté al emisor por correo y confirmó el código y el nombre."
                      />
                      <span className="field-hint">Obligatorio, al menos 20 caracteres. Queda en la auditoría.</span>
                    </div>
                    <div className="flex" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Button
                        size="sm"
                        loading={busy}
                        disabled={motivo.trim().length < 20 || !independiente || prueba.trim().length < 10}
                        onClick={() => decidir(it, 'corroborated')}
                        icon={<FiCheck size={14} />}
                      >
                        Verificada con prueba externa
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'inconclusive')}
                        icon={<FiX size={14} />}
                      >
                        Inconclusa: no pude verificarla
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'rejected')}
                      >
                        Rechazar (contradicción documentada)
                      </Button>
                      <Button size="sm" variant="ghost" onClick={limpiar}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => { limpiar(); setAbierto(it.certificateId); }}>
                    Revisar
                  </Button>
                )}
              </Card>
            </Stagger>
          ))}
        </div>
      )}
    </div>
  );
}
