import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowRight, FiAward, FiBarChart2, FiCalendar, FiCompass, FiFolder, FiUpload, FiUser, FiUsers,
} from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../auth/AuthContext';
import { profileService } from '../../services';
import { Card, SkeletonCards } from '../../components/ui';
import { AffinityBars } from '../../components/charts';
import { ACTIVITY_TYPE_LABEL, PROJECT_STATUS_LABEL, REGISTRATION_STATUS_LABEL, lbl } from '../../constants';
import type { ProfileSummary } from '../../services/types';
import '../../welcome.css';

const aparecer = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};

const ATAJOS = [
  { to: '/student/recommendations', icon: <FiCompass />, t: 'Para ti', d: 'Cursos, charlas y actividades que encajan contigo.', c: 'c1' },
  { to: '/student/activities', icon: <FiCalendar />, t: 'Actividades', d: 'Talleres, charlas y eventos para inscribirte.', c: 'c2' },
  { to: '/student/projects', icon: <FiFolder />, t: 'Mis proyectos', d: 'Lo que construiste, con tu aporte.', c: 'c3' },
  { to: '/student/evidences', icon: <FiUpload />, t: 'Certificados y evidencias', d: 'Lo que demuestra lo que sabes.', c: 'c4' },
  { to: '/student/collaboration', icon: <FiUsers />, t: 'Compañeros y equipos', d: 'Contactos por QR, equipos y mensajes.', c: 'c5' },
  { to: '/student/progress', icon: <FiAward />, t: 'Mi progreso', d: 'Tus puntos, insignias y recompensas.', c: 'c6' },
];

/** El paso más útil que le falta dar, dicho como lo diría una persona. */
function siguientePaso(d: ProfileSummary): { titulo: string; texto: string; to: string; cta: string } {
  if (d.projects.length === 0) {
    return {
      titulo: 'Registra tu primer proyecto',
      texto: 'Un trabajo de materia, un proyecto personal o de un hackatón: cuéntanos qué hiciste y qué tecnologías usaste.',
      to: '/student/projects',
      cta: 'Registrar proyecto',
    };
  }
  if (d.activities.length === 0) {
    return {
      titulo: 'Inscríbete en una actividad',
      texto: 'Cuando el organizador confirme que participaste, quedará en tu trayectoria.',
      to: '/student/activities',
      cta: 'Ver actividades',
    };
  }
  if (d.externalCertificates.length === 0 && d.evidences.length === 0) {
    return {
      titulo: 'Sube un certificado o una evidencia',
      texto: 'Un curso que terminaste o una captura de tu trabajo ayudan a demostrar lo que sabes.',
      to: '/student/evidences',
      cta: 'Subir certificado',
    };
  }
  return {
    titulo: 'Mira lo que te recomendamos',
    texto: 'Con lo que ya cargaste tenemos sugerencias pensadas para ti.',
    to: '/student/recommendations',
    cta: 'Ver recomendaciones',
  };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const summary = useAsync(() => profileService.summary(), []);
  const d = summary.data;

  return (
    <div>
      <motion.div className="home-hero" initial="hidden" animate="show" variants={aparecer}>
        <div>
          <span className="home-kicker">Tu espacio</span>
          <h1>¡Hola{user?.firstName ? `, ${user.firstName}` : ''}!</h1>
          <p>
            {d?.profile.semester ? `${d.profile.semester}º semestre · ` : ''}
            Aquí ves cómo va tu trayectoria y qué puedes hacer ahora.
          </p>
        </div>
        <Link to="/student/profile" className="home-hero-btn">
          <FiUser /> Mi perfil
        </Link>
      </motion.div>

      {summary.loading && !d ? (
        <SkeletonCards count={3} />
      ) : summary.error ? (
        <Card><p className="muted">{summary.error}</p></Card>
      ) : d ? (
        <>
          {(() => {
            const paso = siguientePaso(d);
            return (
              <motion.div className="next-step" variants={aparecer} initial="hidden" animate="show" custom={1}>
                <span className="ns-icon"><FiArrowRight /></span>
                <div className="grow">
                  <span className="ns-kicker">Tu siguiente paso</span>
                  <strong>{paso.titulo}</strong>
                  <p>{paso.texto}</p>
                </div>
                <Link to={paso.to} className="btn btn-primary">{paso.cta}</Link>
              </motion.div>
            );
          })()}

          <div className="home-stats">
            {[
              { n: d.projects.length, l: 'proyectos', c: 'c3' },
              { n: d.activities.length, l: 'actividades', c: 'c2' },
              { n: d.externalCertificates.length + d.internalConstancies.length, l: 'certificados y constancias', c: 'c4' },
              { n: d.skills.length, l: 'tecnologías con respaldo', c: 'c1' },
            ].map((s, i) => (
              <motion.div key={s.l} className={`home-stat ${s.c}`} variants={aparecer} initial="hidden" animate="show" custom={i + 2}>
                <span className="n">{s.n}</span>
                <span className="l">{s.l}</span>
              </motion.div>
            ))}
          </div>

          <div className="dash-grid3" style={{ marginTop: '1rem' }}>
            <div className="chart-card">
              <div className="flex between">
                <h3>Tus áreas fuertes</h3>
                <Link to="/student/affinity" className="btn btn-ghost btn-sm">Ver detalle</Link>
              </div>
              {d.affinities.length > 0 ? (
                <AffinityBars data={d.affinities.map((a) => ({ area: a.area ?? '—', score: Number(a.score), level: a.level }))} />
              ) : (
                <p className="muted">Aparecen a medida que cargas proyectos, actividades y certificados.</p>
              )}
            </div>

            <Card title="Tus actividades">
              {d.activities.length === 0 ? (
                <p className="muted">Todavía no te inscribiste en ninguna.</p>
              ) : (
                d.activities.slice(0, 4).map((a) => (
                  <div className="act-item" key={a.activityId}>
                    <span className="ai"><FiCalendar /></span>
                    <span className="grow"><b>{a.title}</b><span>{lbl(ACTIVITY_TYPE_LABEL, a.type ?? '')}</span></span>
                    <span className="badge badge-bordo">{lbl(REGISTRATION_STATUS_LABEL, a.status)}</span>
                  </div>
                ))
              )}
            </Card>

            <Card title="Tus proyectos">
              {d.projects.length === 0 ? (
                <p className="muted">Todavía no registraste ninguno.</p>
              ) : (
                d.projects.slice(0, 4).map((p) => (
                  <div className="act-item" key={p.id}>
                    <span className="ai"><FiFolder /></span>
                    <span className="grow"><b>{p.title}</b><span>{(p.technologies ?? []).join(', ') || '—'}</span></span>
                    <span className="badge badge-gray">{lbl(PROJECT_STATUS_LABEL, p.status)}</span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <h2 className="home-h2">¿Qué quieres hacer?</h2>
          <div className="qa-grid">
            {ATAJOS.map((q, i) => (
              <motion.div key={q.t} variants={aparecer} initial="hidden" animate="show" custom={i}>
                <Link to={q.to} className={`qa-card tinted ${q.c}`}>
                  <span className="qi">{q.icon}</span>
                  <b>{q.t}</b>
                  <span>{q.d}</span>
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="home-foot">
            <FiBarChart2 /> Lo que declaras orienta tus recomendaciones; tus proyectos, actividades y
            certificados son lo que demuestra tus áreas fuertes.
          </p>
        </>
      ) : null}
    </div>
  );
}
