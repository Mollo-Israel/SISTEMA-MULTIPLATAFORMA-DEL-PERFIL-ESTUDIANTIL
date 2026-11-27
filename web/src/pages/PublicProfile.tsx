import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiAlertCircle, FiShield, FiUser, FiUserPlus } from 'react-icons/fi';
import { RolNombre } from '../constants';
import { collaborationService, uploadService, type PublicProfileView } from '../services';
import { Badge, Button, Card, Loading } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { apiError } from '../api/client';

const NIVEL: Record<string, string> = { high: 'alto', medium: 'medio', low: 'bajo' };
const DISPONIBILIDAD: Record<string, string> = {
  looking: 'Busca sumarse a algo',
  open: 'Escucha propuestas',
  busy: 'Sin margen por ahora',
  unspecified: 'No lo declaró',
};
const RESPALDO: Record<string, string> = {
  declared: 'Declarado',
  supported: 'Respaldado',
  corroborated: 'Corroborado',
  reviewed: 'Revisado por un docente',
  flagged: 'Marcado por inconsistencia',
};

/**
 * V7.1 §12.1: desde el perfil que abrió un enlace o un QR, un estudiante con
 * sesión puede solicitar contacto. No agrega a nadie: la otra persona acepta o
 * rechaza. Sin sesión, o en el propio perfil, no se ofrece ninguna acción.
 */
function SolicitarContacto({ slug }: Readonly<{ slug: string }>) {
  const { user } = useAuth();
  const esEstudiante = user?.role === RolNombre.STUDENT;
  const [propio, setPropio] = useState<boolean | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!esEstudiante) return;
    collaborationService.myPublicLink()
      .then((l) => setPropio(l.slug === slug))
      .catch(() => setPropio(false));
  }, [esEstudiante, slug]);

  if (!esEstudiante || propio !== false) return null;
  const enviar = async () => {
    setEnviando(true);
    try {
      await collaborationService.requestContact({ slug, message: mensaje.trim() || undefined, source: 'qr' });
      setEstado({ tipo: 'ok', texto: 'Solicitud enviada. La otra persona decide si la acepta.' });
    } catch (e) {
      setEstado({ tipo: 'error', texto: apiError(e) });
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Card title="¿Se conocen?">
      <div data-testid="solicitar-desde-perfil">
        <p className="muted" style={{ marginTop: 0 }}>
          Solicitar contacto no te agrega: la otra persona la acepta o la rechaza. Si acepta, verán los canales que cada uno compartió.
        </p>
        {estado?.tipo === 'ok' ? (
          <div className="alert alert-success" role="status">{estado.texto}</div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="perfil-presentacion">Presentación (opcional)</label>
              <input id="perfil-presentacion" value={mensaje} maxLength={300} onChange={(e) => setMensaje(e.target.value)}
                placeholder="Nos vimos en el taller de redes." />
            </div>
            {estado?.tipo === 'error' && <div className="alert alert-error" role="alert">{estado.texto}</div>}
            <Button icon={<FiUserPlus size={15} />} loading={enviando} onClick={() => void enviar()}>Solicitar contacto</Button>
          </>
        )}
      </div>
    </Card>
  );
}

/**
 * Perfil compartible de un estudiante (§43, §44).
 *
 * Es la única pantalla del sistema que se abre sin iniciar sesión, y lo es
 * porque un QR que exigiera una cuenta no serviría para lo que existe: que
 * alguien lo escanee en un pasillo y vea con quién está hablando.
 *
 * Lo que aparece aquí lo decidió su dueño campo por campo. Si algo falta, no es
 * un error de esta pantalla: es que no lo publicó.
 */
export default function PublicProfilePage() {
  const { slug = '' } = useParams();
  const [perfil, setPerfil] = useState<PublicProfileView | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-existe'>('cargando');

  useEffect(() => {
    collaborationService
      .publicProfile(slug)
      .then((p) => {
        setPerfil(p);
        setEstado('listo');
      })
      .catch(() => setEstado('no-existe'));
  }, [slug]);

  if (estado === 'cargando') return <div className="public-page"><Loading /></div>;

  if (estado === 'no-existe' || !perfil) {
    return (
      <div className="public-page">
        <Card>
          <div className="state">
            <FiAlertCircle size={26} />
            {/*
              El mismo mensaje para un enlace inventado y para un perfil que
              existe pero no está publicado. Distinguirlos revelaría quién tiene
              cuenta, que es justo lo que §44 evita.
            */}
            <p className="muted">
              Este enlace no lleva a ningún perfil compartible. Puede que su dueño lo haya
              desactivado o cambiado.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="public-page">
      <PerfilPublicoVista perfil={perfil} />
      <SolicitarContacto slug={slug} />
      <p className="muted" style={{ textAlign: 'center', fontSize: '0.8rem' }}>
        Afinia · Perfil compartible. Solo se muestra lo que su dueño decidió publicar.
      </p>
    </div>
  );
}

/**
 * V6 §8.2: lo que ve un visitante. La usa también la vista previa de «Mi
 * perfil → Visibilidad» con la misma respuesta pública: no hay una vista
 * previa aparte que pueda mostrar de más.
 */
export function PerfilPublicoVista({ perfil }: Readonly<{ perfil: PublicProfileView }>) {
  return (
    <>
      <Card>
        <div className="flex" style={{ gap: '0.8rem', alignItems: 'center' }}>
          {perfil.photoUrl
            ? <img src={uploadService.fileUrl(perfil.photoUrl)} alt={`Foto de ${perfil.name}`} className="foto-perfil" data-testid="foto-publica" />
            : <FiUser size={26} />}
          <div>
            <h1 style={{ margin: 0 }}>{perfil.name}</h1>
            {perfil.semester && (
              <span className="muted">{perfil.semester}.º semestre · Ingeniería en Sistemas</span>
            )}
          </div>
        </div>

        {perfil.bio && <p style={{ marginTop: '1rem' }}>{perfil.bio}</p>}

        {perfil.availability && (
          <p className="muted" style={{ marginTop: '0.4rem' }}>
            {DISPONIBILIDAD[perfil.availability] ?? perfil.availability}
            {(perfil.collaborationInterests ?? []).length > 0
              && ` · Le interesa: ${perfil.collaborationInterests!.join(', ')}`}
          </p>
        )}
      </Card>

      {(perfil.areas ?? []).length > 0 && (
        <Card title="Áreas en las que trabaja">
          <div className="chip-row">
            {perfil.areas!.map((a, i) => (
              <span key={`${a.area}-${i}`} className="chip">
                {a.area}
                {a.score !== undefined && ` · ${a.score}/100`}
                {a.supportLevel && ` · respaldo ${NIVEL[a.supportLevel] ?? a.supportLevel}`}
              </span>
            ))}
          </div>
        </Card>
      )}

      {(perfil.skills ?? []).length > 0 && (
        <Card title="Tecnologías con respaldo">
          <div className="chip-row">
            {perfil.skills!.map((s, i) => (
              <span key={`${s.name}-${i}`} className="chip">{s.name}</span>
            ))}
          </div>
        </Card>
      )}

      {(perfil.projects ?? []).length > 0 && (
        <Card title="Proyectos">
          {perfil.projects!.map((p, i) => (
            <div key={`${p.title}-${i}`} className="mt">
              <div className="flex between">
                <strong>{p.title}</strong>
                {p.backingTier && (
                  <Badge tone={p.backingTier === 'flagged' ? 'red' : 'gray'}>
                    <FiShield size={11} /> {RESPALDO[p.backingTier] ?? p.backingTier}
                  </Badge>
                )}
              </div>
              {p.description && <p className="muted">{p.description}</p>}
              {(p.technologies ?? []).length > 0 && (
                <div className="chip-row">
                  {p.technologies!.map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {perfil.trajectory && (
        <Card title="Trayectoria">
          <p className="muted">
            {perfil.trajectory.areasCount} áreas con trayectoria registrada ·{' '}
            {perfil.trajectory.signalsCount} señales consideradas · respaldo medio{' '}
            {perfil.trajectory.averageSupport}/100
          </p>
        </Card>
      )}

      {(perfil.contactChannels ?? []).length > 0 && (
        <Card title="Contacto">
          <div className="chip-row">
            {perfil.contactChannels!.map((c) => (c.href ? (
              <a key={c.channel} className="chip" href={c.href} target="_blank" rel="noopener noreferrer">{c.label}</a>
            ) : null))}
          </div>
        </Card>
      )}

    </>
  );
}
