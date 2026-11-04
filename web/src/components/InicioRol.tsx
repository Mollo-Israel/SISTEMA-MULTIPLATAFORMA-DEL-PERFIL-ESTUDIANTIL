import { useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiAward, FiBarChart2, FiBookOpen, FiCalendar, FiCheckSquare, FiChevronRight, FiFolder, FiGift, FiPlus,
  FiShield, FiStar, FiUnlock, FiUser, FiUsers,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { RolNombre } from '../constants';
import { PrimeraVisita } from './primeraVisita';

/*
 * V7: el inicio de Docente, Dirección y Sociedad saluda y ofrece accesos con
 * palabras simples, como el del estudiante. Solo enlaces a pantallas que ya
 * existen; no cambia qué puede hacer cada rol.
 */

interface Atajo { to: string; icon: ReactNode; t: string; d: string }
interface Config {
  kicker: string;
  texto: string;
  principal: { to: string; label: string; icon: ReactNode };
  secundario?: { to: string; label: string };
  atajos: Atajo[];
}

const CONFIG: Record<string, Config> = {
  [RolNombre.TEACHER]: {
    kicker: 'Tu espacio docente',
    texto: 'Mira cómo van tus estudiantes y qué puedes hacer hoy. Es una vista descriptiva: no es nota ni ranking.',
    principal: { to: '/teacher?tab=estudiantes', label: 'Ver mis estudiantes', icon: <FiUsers /> },
    secundario: { to: '/teacher/my-activities', label: 'Mis actividades' },
    atajos: [
      { to: '/teacher?tab=estudiantes', icon: <FiUser />, t: 'Mis estudiantes', d: 'Quiénes son y en qué andan.' },
      { to: '/teacher?tab=proyectos', icon: <FiFolder />, t: 'Revisar proyectos', d: 'Sus proyectos y lo que los respalda.' },
      { to: '/teacher/my-activities', icon: <FiCalendar />, t: 'Organizar actividades', d: 'Crea talleres y confirma asistencia.' },
      { to: '/teacher?tab=equipos', icon: <FiUsers />, t: 'Equipos que buscan gente', d: 'Ayuda a formar equipos.' },
      { to: '/teacher/resources', icon: <FiBookOpen />, t: 'Recomendar recursos', d: 'Material para que aprendan.' },
      { to: '/teacher/points', icon: <FiGift />, t: 'Dar puntos', d: 'Reconoce su participación.' },
    ],
  },
  [RolNombre.CAREER_DIRECTOR]: {
    kicker: 'Dirección de carrera',
    texto: 'Lo que espera tu decisión y un vistazo a la carrera, en un solo lugar.',
    principal: { to: '/director/approvals', label: 'Ver lo que espera aprobación', icon: <FiCheckSquare /> },
    secundario: { to: '/director/analytics', label: 'Ver analítica' },
    atajos: [
      { to: '/director/approvals', icon: <FiCheckSquare />, t: 'Aprobar actividades', d: 'Lo que proponen docentes y sociedades.' },
      { to: '/director/credential-reviews', icon: <FiShield />, t: 'Revisar credenciales', d: 'Solo los casos especiales.' },
      { to: '/director/activities', icon: <FiCalendar />, t: 'Actividades', d: 'Todo lo que ofrece la carrera.' },
      { to: '/director/constancies', icon: <FiAward />, t: 'Participaciones', d: 'Quién participó y en qué.' },
      { to: '/director/analytics', icon: <FiBarChart2 />, t: 'Cómo va la carrera', d: 'Participación, afinidad y tendencias.' },
      { to: '/director/autonomy', icon: <FiUnlock />, t: 'Autonomía docente', d: 'Qué aprueba cada docente.' },
    ],
  },
  [RolNombre.SCIENTIFIC_SOCIETY]: {
    kicker: 'Tu sociedad científica',
    texto: 'Organiza actividades, mira quién se inscribe y cuánto alcance tienen.',
    principal: { to: '/society/activities?nuevo=1', label: 'Crear actividad', icon: <FiPlus /> },
    secundario: { to: '/society/participants', label: 'Ver inscritos' },
    atajos: [
      { to: '/society/activities', icon: <FiCalendar />, t: 'Mis actividades', d: 'Crea, edita y publica.' },
      { to: '/society/participants', icon: <FiUsers />, t: 'Inscritos y asistencia', d: 'Confirma quién participó.' },
      { to: '/society/metrics', icon: <FiBarChart2 />, t: 'Alcance', d: 'Cuántos llegan a lo que organizas.' },
      { to: '/proyectos', icon: <FiStar />, t: 'Proyectos de la carrera', d: 'Lo que hacen los estudiantes.' },
    ],
  },
};

const aparecer = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35 } }),
};

/** Saludo con el nombre y la acción más común del rol. */
export function SaludoRol() {
  const { user } = useAuth();
  const primera = useContext(PrimeraVisita);
  const c = user ? CONFIG[user.role] : undefined;
  if (!user || !c) return null;
  return (
    <motion.div className="rol-hero" initial={primera ? 'hidden' : false} animate="show" variants={aparecer}>
      <div>
        {/* El título de la página sigue siendo «Inicio» (h1); el saludo es grande pero no es encabezado. */}
        <h1 className="rh-kicker">Inicio · {c.kicker}</h1>
        <strong className="rh-saludo">¡Hola{user.firstName ? `, ${user.firstName}` : ''}!</strong>
        <p>{c.texto}</p>
      </div>
      <div className="rh-acciones">
        <Link to={c.principal.to} className="rh-btn">{c.principal.icon} {c.principal.label}</Link>
        {c.secundario && <Link to={c.secundario.to} className="rh-btn ghost">{c.secundario.label}</Link>}
      </div>
    </motion.div>
  );
}

/** «¿Qué quieres hacer?»: accesos con una línea que explica cada uno. */
export function AtajosRol() {
  const { user } = useAuth();
  const primera = useContext(PrimeraVisita);
  const c = user ? CONFIG[user.role] : undefined;
  if (!c) return null;
  return (
    <>
      <h2 className="rol-atajos-t">¿Qué quieres hacer?</h2>
      <div className="rol-atajos">
        {c.atajos.map((a, i) => (
          <motion.div key={a.t} variants={aparecer} initial={primera ? 'hidden' : false} animate="show" custom={i}>
            <Link to={a.to} className={`rol-atajo t${i % 6}`}>
              <span className="ra-ico">{a.icon}</span>
              <b>{a.t}</b>
              <span className="ra-d">{a.d}</span>
              <FiChevronRight className="ra-go" />
            </Link>
          </motion.div>
        ))}
      </div>
    </>
  );
}
