import { useCallback, useEffect, useState } from 'react';
import { FiAward, FiRefreshCw } from 'react-icons/fi';
import { apiError } from '../api/client';
import { constancyService, uploadService } from '../services';
import type { Activity, EligibleParticipant, InstitutionCertificateStatus } from '../services/types';
import { FieldError } from './form';
import { Badge, Button, Modal } from './ui';
import { useToast } from './feedback';

type Envio = { participante: EligibleParticipant; reemplazo: boolean };

/**
 * V7.1 §6.3 (D05) · Certificado institucional de una actividad.
 *
 *  - GENERAL: el responsable sube una vez el documento real; se entrega solo a
 *    los confirmados cuando la actividad terminó y la lista está cerrada. Si
 *    falta algo, se dice qué. Nunca se fabrica un documento.
 *  - INDIVIDUAL (o sin tipo, como antes): se entrega a cada estudiante su
 *    archivo. Lo ya entregado muestra «Entregado» con su fecha; reemplazarlo es
 *    excepcional y pide motivo.
 */
export default function CertificadoInstitucional({ activity }: Readonly<{ activity: Activity }>) {
  const toast = useToast();
  const [estado, setEstado] = useState<InstitutionCertificateStatus | null>(null);
  const [lista, setLista] = useState<EligibleParticipant[]>([]);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [archivo, setArchivo] = useState<{ id: string; nombre: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const terminada = activity.status === 'finished';

  const cargar = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        constancyService.institutionStatus(activity.id),
        constancyService.eligible(activity.id),
      ]);
      setEstado(s);
      setLista(l);
    } catch (e) {
      toast.error(apiError(e));
    }
  }, [activity.id, toast]);
  useEffect(() => { void cargar(); }, [cargar]);

  const subir = async (f: File | undefined, alSubir: (x: { id: string; nombre: string }) => void) => {
    if (!f) return;
    try {
      const s = await uploadService.upload(f);
      alSubir({ id: s.id, nombre: s.originalFilename ?? f.name });
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const archivoGeneral = async (f: File | undefined) => subir(f, async ({ id }) => {
    setOcupado(true);
    try {
      const r = await constancyService.setGeneralFile(activity.id, id);
      toast.success(r.delivered ? `Certificado entregado a ${r.delivered} estudiante(s).` : 'Archivo guardado. Se entregará solo al cumplirse el fin y el cierre de la lista.');
      await cargar();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setOcupado(false);
    }
  });

  const entregar = async () => {
    if (!envio) return;
    if (estado?.mode === 'individual' && !archivo) { setError('Adjunta el archivo de este estudiante.'); return; }
    if (envio.reemplazo && motivo.trim().length < 10) { setError('Explica el motivo del reemplazo (al menos 10 caracteres).'); return; }
    setOcupado(true);
    try {
      await constancyService.deliverInstitutionCertificates(activity.id, {
        profileIds: [envio.participante.studentProfileId],
        ...(archivo ? { storedFileId: archivo.id } : {}),
        ...(codigo.trim() ? { certificateCode: codigo.trim() } : {}),
        ...(envio.reemplazo ? { replaceReason: motivo.trim() } : {}),
      });
      toast.success(envio.reemplazo ? 'Certificado reemplazado; la versión anterior queda en el historial.' : 'Certificado entregado.');
      setEnvio(null);
      await cargar();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setOcupado(false);
    }
  };

  if (!estado) return null;
  const fecha = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-BO') : '');

  return (
    <div className="certificado-institucional" data-testid="certificado-institucional" style={{ marginTop: '0.8rem' }}>
      <h4 style={{ margin: '0 0 0.3rem' }}>
        <FiAward /> Certificado institucional {estado.mode === 'general' ? '(general)' : estado.mode === 'individual' ? '(individual)' : ''}
      </h4>
      <p className="muted small" style={{ margin: 0 }}>
        Emite: {estado.issuer ?? '—'}. Afinia lo registra; no se atribuye la autoría. Entregados: {estado.delivered} de {estado.confirmed} confirmados.
      </p>

      {estado.mode === 'general' ? (
        <div style={{ marginTop: '0.5rem' }}>
          {estado.pendingMessage && <p className="inline-note" data-testid="certificado-pendiente">{estado.pendingMessage}</p>}
          <p className="small">Documento común: <strong>{estado.generalFileName ?? 'sin subir'}</strong></p>
          {estado.delivered === 0 && (
            <div className="field">
              <label htmlFor={`general-${activity.id}`}>{estado.generalFileName ? 'Cambiar el documento común' : 'Subir el documento real del certificado'}</label>
              <input id={`general-${activity.id}`} type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
                disabled={ocupado} onChange={(e) => void archivoGeneral(e.target.files?.[0])} />
              <span className="field-hint">Queda privado hasta la entrega. No se reparte un documento con el nombre de una sola persona.</span>
            </div>
          )}
        </div>
      ) : (
        <ul className="certificados-lista" style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
          {lista.map((p) => (
            <li key={p.studentProfileId} className="flex" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.25rem 0' }}>
              <span className="grow">{p.studentName ?? 'Estudiante'}</span>
              {p.hasConstancy ? (
                <>
                  <span data-testid="entregado"><Badge tone="green">Entregado {fecha(p.deliveredAt)}{p.version && p.version > 1 ? ` · v${p.version}` : ''}</Badge></span>
                  <Button size="sm" variant="ghost" icon={<FiRefreshCw size={13} />} disabled={!terminada}
                    onClick={() => { setEnvio({ participante: p, reemplazo: true }); setArchivo(null); setCodigo(''); setMotivo(''); setError(null); }}>
                    Reemplazar
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" icon={<FiAward size={14} />} disabled={!terminada}
                  title={terminada ? undefined : 'Se entrega cuando la actividad terminó.'}
                  onClick={() => { setEnvio({ participante: p, reemplazo: false }); setArchivo(null); setCodigo(''); setMotivo(''); setError(null); }}>
                  Entregar certificado
                </Button>
              )}
            </li>
          ))}
          {!terminada && <li className="muted small">El certificado se entrega cuando la actividad terminó.</li>}
        </ul>
      )}

      {envio && (
        <Modal title={envio.reemplazo ? 'Reemplazar certificado' : 'Entregar certificado'} subtitle={envio.participante.studentName ?? ''} onClose={() => setEnvio(null)} width={520}>
          {envio.reemplazo && (
            <p className="inline-note">Reemplazar es excepcional: el estudiante recibe un aviso con el motivo y la versión anterior queda en el historial.</p>
          )}
          <div className="field">
            <label htmlFor="cert-archivo">Archivo del certificado{estado.mode === 'individual' ? ' (de este estudiante)' : ' (opcional)'}</label>
            <input id="cert-archivo" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => void subir(e.target.files?.[0], (x) => { setArchivo(x); setError(null); })} />
            {archivo && <span className="field-hint">Adjunto: {archivo.nombre}</span>}
          </div>
          <div className="field">
            <label htmlFor="cert-codigo">Código de verificación del emisor (opcional)</label>
            <input id="cert-codigo" value={codigo} maxLength={80} onChange={(e) => setCodigo(e.target.value)} placeholder="UV-2026-0042" />
          </div>
          {envio.reemplazo && (
            <div className="field">
              <label htmlFor="cert-motivo">Motivo del reemplazo</label>
              <textarea id="cert-motivo" value={motivo} maxLength={300} onChange={(e) => { setMotivo(e.target.value); setError(null); }} />
            </div>
          )}
          <FieldError message={error} />
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setEnvio(null)}>Cancelar</Button>
            <Button loading={ocupado} icon={<FiAward size={14} />} onClick={() => void entregar()}>{envio.reemplazo ? 'Reemplazar' : 'Entregar'}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
