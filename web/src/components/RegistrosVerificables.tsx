import { useEffect, useState } from 'react';
import { FaLinkedin } from 'react-icons/fa';
import { FiAward, FiCode, FiDownload, FiExternalLink, FiFileText, FiImage, FiInfo, FiLink, FiShield } from 'react-icons/fi';
import { apiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { credentialService, ESTADO_REGISTRO, guardarArchivo } from '../services/credentials';
import type { DownloadFormat, VerifiableCredentialItem } from '../services/credentials';
import { AsyncView, Badge, Button, Card, CopyButton, EmptyState, Modal } from './ui';
import { useToast } from './feedback';

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

const NOMBRE: Record<DownloadFormat, string> = {
  pdf: 'pdf', json: 'json', jwt: 'jwt', svg: 'svg', png: 'png', qr: 'svg',
};

/** El QR de verificación, como imagen. Se pide con sesión y se muestra como blob. */
function VerQr({ item, onClose }: Readonly<{ item: VerifiableCredentialItem; onClose: () => void }>) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objeto: string | null = null;
    credentialService.download(item.id, 'qr').then((b) => {
      objeto = URL.createObjectURL(b);
      setUrl(objeto);
    }).catch(() => setUrl(null));
    return () => { if (objeto) URL.revokeObjectURL(objeto); };
  }, [item.id]);
  return (
    <Modal title="QR de verificación" subtitle={item.achievementName} onClose={onClose} width={420}>
      <div className="vc-qr">{url ? <img src={url} alt={`QR que lleva a la verificación de ${item.code}`} /> : <p className="muted">Cargando…</p>}</div>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Quien lo escanee verá si el registro es auténtico y está vigente. No contiene datos personales: solo el enlace.
      </p>
      <p className="vc-mono" style={{ textAlign: 'center', fontWeight: 700 }}>{item.code}</p>
    </Modal>
  );
}

/**
 * V8 · Mis registros verificables.
 *
 * Lo que Afinia registró de ti, firmado digitalmente para que cualquiera lo
 * compruebe sin pedirte acceso: PDF con QR, insignias que llevan la firma
 * adentro, Open Badges para tu billetera digital y un enlace para LinkedIn.
 */
export default function RegistrosVerificables() {
  const toast = useToast();
  const datos = useAsync(() => credentialService.mine(), []);
  const [emitiendo, setEmitiendo] = useState(false);
  const [qr, setQr] = useState<VerifiableCredentialItem | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const emitir = async () => {
    setEmitiendo(true);
    try {
      const r = await credentialService.issueMine();
      toast.success(r.issued === 1 ? 'Se firmó 1 registro.' : `Se firmaron ${r.issued} registros.`);
      datos.reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setEmitiendo(false);
    }
  };

  const bajar = async (item: VerifiableCredentialItem, formato: DownloadFormat) => {
    setDescargando(`${item.id}:${formato}`);
    try {
      const blob = await credentialService.download(item.id, formato);
      guardarArchivo(blob, `registro-${item.code}.${NOMBRE[formato]}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setDescargando(null);
    }
  };

  const ocupado = (item: VerifiableCredentialItem, f: DownloadFormat) => descargando === `${item.id}:${f}`;

  return (
    <>
      <p className="inline-note">
        <FiInfo />
        <span>
          Un <strong>registro verificable</strong> es la versión firmada digitalmente de lo que Afinia registró: tu participación confirmada o un
          certificado que la institución te entregó. No es un certificado académico. Quien lo reciba puede comprobarlo en
          {' '}<a href="/verificar" target="_blank" rel="noreferrer">la página de verificación</a>, sin cuenta.
        </span>
      </p>

      <AsyncView loading={datos.loading} error={datos.error} data={datos.data}>
        {(d) => (
          <>
            {!d.policy.enabled && (
              <Card>
                <p style={{ margin: 0 }}>
                  <strong>Dirección todavía no habilitó la emisión de registros verificables.</strong>{' '}
                  <span className="muted">Cuando lo haga, aquí podrás firmar tus participaciones. Lo ya emitido se sigue verificando.</span>
                </p>
              </Card>
            )}
            {d.policy.enabled && d.pending.length > 0 && (
              <Card
                title={d.pending.length === 1 ? 'Tienes 1 hecho por firmar' : `Tienes ${d.pending.length} hechos por firmar`}
                actions={<Button onClick={emitir} loading={emitiendo} icon={<FiShield />}>Firmar mis registros</Button>}
              >
                <ul className="muted small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {d.pending.slice(0, 6).map((p) => <li key={`${p.sourceType}-${p.title}`}>{p.title} · {p.sourceLabel}</li>)}
                  {d.pending.length > 6 && <li>y {d.pending.length - 6} más</li>}
                </ul>
              </Card>
            )}

            {d.items.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<FiAward size={22} />}
                  message={d.pending.length ? 'Aún no firmaste ningún registro.' : 'Cuando confirmen tu participación en una actividad, podrás firmarla aquí.'}
                />
              </Card>
            ) : (
              <div className="vc-tarjetas">
                {d.items.map((item) => {
                  const est = ESTADO_REGISTRO[item.status];
                  return (
                    <div className="vc-tarjeta" key={item.id}>
                      <span className={`vc-insignia vc-ins-${item.sourceType}`} aria-hidden="true"><FiAward size={28} /></span>
                      <div className="vc-cuerpo">
                        <h4>{item.achievementName}</h4>
                        <div className="flex" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
                          <Badge tone={est.tone}>{est.label}</Badge>
                          <Badge tone="gray">{item.sourceLabel}</Badge>
                          {item.occurredAt && <span className="muted small">Actividad: {fecha(item.occurredAt)}</span>}
                          <span className="muted small">Firmado: {fecha(item.issuedAt)}</span>
                        </div>
                        <div className="flex mt" style={{ marginTop: '0.5rem', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="vc-mono" style={{ fontWeight: 700 }}>{item.code}</span>
                          <CopyButton text={item.verifyUrl} label="Copiar enlace" />
                        </div>
                        {item.status === 'revoked' && item.revocationReason && (
                          <p className="small" style={{ color: 'var(--red)', margin: '0.4rem 0 0' }}>Motivo de la revocación: {item.revocationReason}</p>
                        )}
                        {item.status === 'suspended' && item.suspensionReason && (
                          <p className="small" style={{ color: 'var(--amber)', margin: '0.4rem 0 0' }}>Suspendido: {item.suspensionReason}</p>
                        )}
                        {item.status === 'without_effect' && (
                          <p className="small muted" style={{ margin: '0.4rem 0 0' }}>La participación que lo respaldaba ya no figura como confirmada.</p>
                        )}
                        <div className="vc-acciones">
                          <a className="btn btn-secondary btn-sm" href={item.verifyUrl} target="_blank" rel="noreferrer"><FiExternalLink /> Ver verificación</a>
                          <Button size="sm" variant="secondary" icon={<FiFileText />} loading={ocupado(item, 'pdf')} onClick={() => bajar(item, 'pdf')}>PDF con QR</Button>
                          <Button size="sm" variant="secondary" icon={<FiImage />} loading={ocupado(item, 'png')} onClick={() => bajar(item, 'png')}>Insignia</Button>
                          <Button size="sm" variant="secondary" icon={<FiLink />} onClick={() => setQr(item)}>QR</Button>
                          <Button size="sm" variant="ghost" icon={<FiCode />} loading={ocupado(item, 'json')} onClick={() => bajar(item, 'json')}>Open Badges 3.0</Button>
                          <Button size="sm" variant="ghost" icon={<FiDownload />} loading={ocupado(item, 'svg')} onClick={() => bajar(item, 'svg')}>SVG</Button>
                          <Button size="sm" variant="ghost" icon={<FiDownload />} loading={ocupado(item, 'jwt')} onClick={() => bajar(item, 'jwt')}>VC-JWT</Button>
                          {item.status === 'active' && item.linkedInUrl && (
                            <a className="btn btn-ghost btn-sm" href={item.linkedInUrl} target="_blank" rel="noreferrer noopener"><FaLinkedin /> Agregar a LinkedIn</a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </AsyncView>
      {qr && <VerQr item={qr} onClose={() => setQr(null)} />}
    </>
  );
}
