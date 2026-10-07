import { useEffect, useState } from 'react';
import { FiAward, FiCheck, FiFile, FiLink, FiX } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { manualReviewService, uploadService } from '../../services';
import {
  Badge, Button, Card, Diferido, EmptyState, PageHeader, SkeletonTable, Stagger,
} from '../../components/ui';
import { useToast } from '../../components/feedback';
import type { ManualReviewItem } from '../../services/types';
import { CREDENTIAL_CHECK_LABEL } from '../../services/types';

/**
 * Revisión manual excepcional de credenciales históricas (V3 §16, §19).
 *
 * Solo para credenciales obtenidas antes o fuera de Afinia cuyo emisor no
 * ofrece un verificador digital que el sistema pueda consultar. Es la única
 * vía para que una así llegue a «Corroborado», y por eso exige un motivo y
 * queda auditada.
 */
export default function CredentialReviewsPage() {
  const [items, setItems] = useState<ManualReviewItem[] | null>(null);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const cargar = () => manualReviewService.pending()
    .then(setItems)
    .catch((e) => setError(apiError(e)));
  useEffect(() => { cargar(); }, []);

  const decidir = async (item: ManualReviewItem, decision: 'corroborated' | 'not_corroborated') => {
    setBusy(true);
    try {
      await manualReviewService.decide(item.certificateId, { decision, reason: motivo.trim() });
      toast.success(
        decision === 'corroborated' ? 'Credencial corroborada.' : 'Revisión registrada.',
        decision === 'corroborated'
          ? `${item.studentName} · ya cuenta como corroborada`
          : `${item.studentName} · conserva su nivel actual`,
      );
      setAbierto(null);
      setMotivo('');
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
        description="Credenciales históricas cuyo emisor no ofrece un verificador digital. Revísalas solo si puedes comprobarlas por otra vía: tu decisión es la única que puede corroborarlas y queda registrada."
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
                    <a className="btn btn-secondary btn-sm" href={uploadService.fileUrl(it.fileUrl)} target="_blank" rel="noreferrer">
                      <FiFile /> Ver documento
                    </a>
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
                      <label htmlFor={`motivo-${it.certificateId}`}>Cómo lo comprobaste</label>
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
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'corroborated')}
                        icon={<FiCheck size={14} />}
                      >
                        Corroborar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy}
                        disabled={motivo.trim().length < 20}
                        onClick={() => decidir(it, 'not_corroborated')}
                        icon={<FiX size={14} />}
                      >
                        No puedo corroborarla
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAbierto(null); setMotivo(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => { setAbierto(it.certificateId); setMotivo(''); }}>
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
