import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiAlertCircle, FiShield, FiUser } from 'react-icons/fi';
import { collaborationService, type PublicProfileView } from '../services';
import { Badge, Card, Loading } from '../components/ui';

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
      <Card>
        <div className="flex" style={{ gap: '0.8rem', alignItems: 'center' }}>
          <FiUser size={26} />
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

      <p className="muted" style={{ textAlign: 'center', fontSize: '0.8rem' }}>
        Afinia · Perfil compartible. Solo se muestra lo que su dueño decidió publicar.
      </p>
    </div>
  );
}
