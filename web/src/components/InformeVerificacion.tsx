import { FiAlertTriangle, FiCheckCircle, FiHelpCircle, FiLink, FiMinusCircle, FiShield, FiXCircle } from 'react-icons/fi';
import type { Outcome, VerificationReport } from '../services/credentials';
import { Card } from './ui';

const TONO: Record<Outcome, 'vc-ok' | 'vc-mal' | 'vc-aviso' | 'vc-neutro'> = {
  valid: 'vc-ok',
  valid_external: 'vc-ok',
  document_recognized: 'vc-ok',
  revoked: 'vc-mal',
  invalid: 'vc-mal',
  altered: 'vc-mal',
  suspended: 'vc-aviso',
  without_effect: 'vc-aviso',
  expired: 'vc-aviso',
  unverifiable: 'vc-aviso',
  not_found: 'vc-neutro',
};

function IconoResultado({ outcome }: Readonly<{ outcome: Outcome }>) {
  const t = TONO[outcome];
  if (t === 'vc-ok') return <FiCheckCircle size={34} />;
  if (t === 'vc-mal') return <FiXCircle size={34} />;
  if (t === 'vc-aviso') return <FiAlertTriangle size={34} />;
  return <FiHelpCircle size={34} />;
}

function IconoCheck({ status }: Readonly<{ status: string }>) {
  if (status === 'ok') return <FiCheckCircle className="vc-check-ok" aria-label="correcto" />;
  if (status === 'fail') return <FiXCircle className="vc-check-fail" aria-label="falla" />;
  if (status === 'warn') return <FiAlertTriangle className="vc-check-warn" aria-label="advertencia" />;
  return <FiMinusCircle className="vc-check-skip" aria-label="no aplica" />;
}

const fecha = (v: unknown) => {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
};

const EVENTO: Record<string, string> = {
  ISSUED: 'Firmado y sellado',
  SUSPENDED: 'Suspendido',
  SUSPENSION_LIFTED: 'Suspensión levantada',
  REVOKED: 'Revocado',
};

/**
 * Informe de verificación legible para alguien ajeno al sistema: el veredicto
 * arriba, en una frase; después qué se comprobó, una por una; y al final, los
 * datos técnicos para quien quiera repetir la verificación por su cuenta.
 */
export default function InformeVerificacion({ r }: Readonly<{ r: VerificationReport }>) {
  const c = r.credential ?? {};
  const externo = c.external === true;
  return (
    <div className="vc-tarjetas" aria-live="polite">
      <div className={`vc-resultado ${TONO[r.outcome]}`} role="status">
        <span className="vc-icono"><IconoResultado outcome={r.outcome} /></span>
        <div>
          <h2>{r.title}</h2>
          <p>{r.summary}</p>
        </div>
      </div>

      {Object.keys(c).length > 0 && (
        <Card title={externo ? 'Credencial presentada' : 'Lo que dice el registro'}>
          <dl className="vc-datos">
            {typeof c.holderName === 'string' && <div><dt>Titular</dt><dd>{c.holderName}</dd></div>}
            {typeof c.achievementName === 'string' && <div><dt>Logro</dt><dd>{c.achievementName}</dd></div>}
            {typeof c.sourceLabel === 'string' && <div><dt>Tipo de registro</dt><dd>{c.sourceLabel}</dd></div>}
            {fecha(c.occurredAt) && <div><dt>Fecha de la actividad</dt><dd>{fecha(c.occurredAt)}</dd></div>}
            {fecha(c.issuedAt) && <div><dt>Firmado el</dt><dd>{fecha(c.issuedAt)}</dd></div>}
            {typeof c.issuerName === 'string' && <div><dt>{externo ? 'Emisor declarado' : 'Firmado por'}</dt><dd>{c.issuerName}</dd></div>}
            {typeof c.issuerId === 'string' && <div><dt>Identificador del emisor</dt><dd className="vc-mono small">{c.issuerId}</dd></div>}
            {typeof c.documentIssuer === 'string' && <div><dt>Emisor del certificado</dt><dd>{c.documentIssuer}</dd></div>}
            {typeof c.activityTitle === 'string' && <div><dt>Actividad</dt><dd>{c.activityTitle}</dd></div>}
            {typeof c.code === 'string' && <div><dt>Código</dt><dd className="vc-mono">{c.code}</dd></div>}
          </dl>
          {typeof c.narrative === 'string' && <p className="muted small mt" style={{ marginBottom: 0 }}>{c.narrative}</p>}
        </Card>
      )}

      {r.checks.length > 0 && (
        <Card title="Qué se comprobó">
          <ul className="vc-checks">
            {r.checks.map((k) => (
              <li key={`${k.id}-${k.label}`}>
                <IconoCheck status={k.status} />
                <div>
                  <strong>{k.label}</strong>
                  <span className="muted">{k.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.ledger?.seq && (
        <Card title="Bitácora de transparencia">
          <p className="muted small" style={{ marginTop: 0 }}>
            Cada hecho queda sellado en una cadena de hashes que no se puede reescribir sin que se note.
            Anote la cabeza actual para comprobar más adelante que el pasado no cambió.
          </p>
          <div className="vc-cadena">
            {r.ledger.events.map((e) => (
              <div className="vc-eslabon" key={e.seq}>
                <FiShield />
                <strong>n.º {e.seq}</strong>
                <span>{EVENTO[e.event] ?? e.event}</span>
                <span className="muted small">{fecha(e.at)}</span>
                <span className="vc-mono">{e.hash.slice(0, 24)}…</span>
              </div>
            ))}
            {r.ledger.head && (
              <div className="vc-eslabon">
                <FiLink />
                <span>Cabeza actual de la bitácora: n.º {r.ledger.head.seq}</span>
                <span className="vc-mono">{r.ledger.head.hash.slice(0, 24)}…</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {(r.file || r.links || typeof c.payloadSha256 === 'string') && (
        <Card>
          <details className="vc-tecnico">
            <summary>Datos técnicos (para verificar por cuenta propia)</summary>
            <ul>
              {typeof c.payloadSha256 === 'string' && <li>Huella SHA-256 del registro firmado: <span className="vc-mono">{c.payloadSha256}</span></li>}
              {typeof c.keyId === 'string' && <li>Clave Ed25519: <span className="vc-mono">{c.keyId}</span> · prueba Data Integrity <span className="vc-mono">eddsa-jcs-2022</span></li>}
              {typeof c.documentSha256 === 'string' && <li>SHA-256 del certificado entregado: <span className="vc-mono">{c.documentSha256}</span></li>}
              {r.file && typeof r.file.sha256 === 'string' && <li>SHA-256 del archivo revisado: <span className="vc-mono">{r.file.sha256}</span></li>}
              {r.links && Object.entries(r.links).map(([k, v]) => (
                <li key={k}><a href={v} target="_blank" rel="noreferrer noopener">{ETIQUETA_ENLACE[k] ?? k}</a></li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </div>
  );
}

const ETIQUETA_ENLACE: Record<string, string> = {
  ob3: 'Credencial Open Badges 3.0 (JSON firmado)',
  ob2Assertion: 'Aserción Open Badges 2.0 (alojada)',
  issuer: 'Perfil del emisor y sus claves públicas',
  statusRevocation: 'Lista de revocación firmada',
  statusSuspension: 'Lista de suspensión firmada',
  ledgerHead: 'Cabeza de la bitácora',
};
