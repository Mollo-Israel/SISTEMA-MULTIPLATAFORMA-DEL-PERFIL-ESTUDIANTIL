import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiFolder, FiCalendar, FiTarget, FiBarChart2, FiUpload, FiCheckCircle, FiCircle, FiAward, FiFileText, FiHelpCircle,
} from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { profileService } from '../../services';
import { AsyncView, Card } from '../../components/ui';
import { AffinityBars, CompletionDonut } from '../../components/charts';
import { ACTIVITY_TYPE_LABEL, PROFILE_STATUS_LABEL, PROJECT_STATUS_LABEL, REGISTRATION_STATUS_LABEL, lbl } from '../../constants';

const tile = { hidden: { opacity: 0, y: 16 }, show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }) };

const QUICK = [
  { to: '/student/projects', icon: <FiFolder />, t: 'Registrar proyecto', d: 'Documenta tus proyectos.' },
  { to: '/student/projects', icon: <FiUpload />, t: 'Subir evidencia', d: 'Comparte tus logros.' },
  { to: '/student/activities', icon: <FiCalendar />, t: 'Ver actividades', d: 'Talleres y eventos.' },
  { to: '/student/affinity', icon: <FiBarChart2 />, t: 'Ver afinidades', d: 'Tus áreas destacadas.' },
  { to: '/student/interests', icon: <FiTarget />, t: 'Intereses y habilidades', d: 'Actualiza tu perfil.' },
];

export default function StudentDashboard() {
  const summary = useAsync(() => profileService.summary().catch(() => null), []);

  return (
    <div>
      <h1>Mi panel</h1>
      <p className="muted">Tu perfil se construye con lo que declaras y con tu actividad académica.</p>

      {!summary.loading && !summary.data && (
        <Card title="Aún no tienes perfil">
          <p className="muted">Crea tu perfil dinámico para empezar a construir tu portafolio académico.</p>
          <Link to="/student/profile" className="btn btn-primary mt">Crear mi perfil</Link>
        </Card>
      )}

      <AsyncView loading={summary.loading} error={summary.error} data={summary.data} emptyMessage="">
        {(d) => {
          const checklist = [
            { t: 'Definir semestre', done: !!d.profile.semester },
            { t: 'Agregar descripción', done: !!d.profile.bio },
            { t: 'Registrar intereses', done: d.interests.length > 0 },
            { t: 'Declarar habilidades', done: d.skills.length > 0 },
            { t: 'Áreas a mejorar', done: d.improvementAreas.length > 0 },
          ];
          const affinityData = d.affinities.map((a) => ({ area: a.area ?? '—', score: Number(a.score), level: a.level }));

          return (
            <>
              <div className="dash-grid3">
                {/* Completa tu perfil */}
                <div className="chart-card">
                  <h3>Completa tu perfil</h3>
                  <CompletionDonut value={d.profile.completionPercentage} />
                  <ul className="checklist">
                    {checklist.map((c) => (
                      <li key={c.t}>
                        {c.done ? <FiCheckCircle className="done" /> : <FiCircle className="todo" />} {c.t}
                      </li>
                    ))}
                  </ul>
                  <Link to="/student/profile" className="btn btn-primary btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}>Completar perfil</Link>
                </div>

                {/* Áreas de afinidad */}
                <div className="chart-card">
                  <div className="flex between"><h3>Áreas de afinidad</h3><Link to="/student/affinity" className="btn btn-ghost btn-sm">Ver todo</Link></div>
                  <AffinityBars data={affinityData} />
                  {affinityData.length === 0 && <p className="muted">Agrega intereses, habilidades y proyectos, luego recalcula.</p>}
                </div>

                {/* Actividades recientes */}
                <Card title="Actividades recientes">
                  {d.activities.length === 0 ? <p className="muted">Aún no te inscribes en actividades.</p> : (
                    d.activities.slice(0, 5).map((a) => (
                      <div className="act-item" key={a.activityId}>
                        <span className="ai"><FiCalendar /></span>
                        <span className="grow"><b>{a.title}</b><span>{lbl(ACTIVITY_TYPE_LABEL, a.type ?? '')}</span></span>
                        <span className="badge badge-bordo">{lbl(REGISTRATION_STATUS_LABEL, a.status)}</span>
                      </div>
                    ))
                  )}
                </Card>
              </div>

              <div className="dash-grid3" style={{ marginTop: '1rem' }}>
                {/* Proyectos */}
                <Card title="Proyectos registrados" actions={<Link to="/student/projects" className="btn btn-ghost btn-sm">Ver todos</Link>}>
                  {d.projects.length === 0 ? <p className="muted">Sin proyectos.</p> : (
                    d.projects.slice(0, 3).map((p) => (
                      <div className="act-item" key={p.id}>
                        <span className="ai"><FiFolder /></span>
                        <span className="grow"><b>{p.title}</b><span>{(p.technologies ?? []).join(', ') || '—'}</span></span>
                        <span className="badge badge-gray">{lbl(PROJECT_STATUS_LABEL, p.status)}</span>
                      </div>
                    ))
                  )}
                  <Link to="/student/projects" className="btn btn-secondary btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}>Registrar proyecto</Link>
                </Card>

                {/* Evidencias y certificados */}
                <Card title="Evidencias y certificados">
                  <div className="ev-tiles">
                    <div className="ev-tile"><div className="n">{d.evidences.length}</div><div className="l">Evidencias</div></div>
                    <div className="ev-tile green"><div className="n">{d.externalCertificates.length}</div><div className="l">Certificados</div></div>
                    <div className="ev-tile amber"><div className="n">{d.internalConstancies.length}</div><div className="l">Constancias</div></div>
                    <div className="ev-tile"><div className="n">{d.interests.length + d.skills.length}</div><div className="l">Intereses + habilidades</div></div>
                  </div>
                  <Link to="/student/projects" className="btn btn-secondary btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}>Subir evidencia</Link>
                </Card>

                {/* Resumen */}
                <Card title="Resumen del perfil">
                  <p><strong>Semestre:</strong> {d.profile.semester ?? '—'}</p>
                  <p><strong>Estado:</strong> {lbl(PROFILE_STATUS_LABEL, d.profile.status)}</p>
                  <p><strong>Áreas a mejorar:</strong> {d.improvementAreas.map((a) => a.name).join(', ') || '—'}</p>
                  <Link to="/student/affinity" className="btn btn-primary btn-sm mt" style={{ width: '100%', justifyContent: 'center' }}>Ver mis afinidades</Link>
                </Card>
              </div>

              {/* Acciones rápidas */}
              <h2 style={{ margin: '1.6rem 0 0.7rem' }}>Acciones rápidas</h2>
              <div className="qa-grid">
                {QUICK.map((q, i) => (
                  <motion.div key={q.t + i} variants={tile} initial="hidden" animate="show" custom={i}>
                    <Link to={q.to} className="qa-card">
                      <span className="qi">{q.icon}</span>
                      <b>{q.t}</b>
                      <span>{q.d}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Ayuda */}
              <div className="help-banner">
                <span className="hi"><FiHelpCircle /></span>
                <div className="grow">
                  <strong>¿Necesitas ayuda para avanzar?</strong>
                  <div className="muted">Completa tu perfil y registra evidencias para mejorar tus áreas de afinidad.</div>
                </div>
                <Link to="/student/profile" className="btn btn-primary btn-sm">Completar perfil</Link>
              </div>
            </>
          );
        }}
      </AsyncView>
    </div>
  );
}
