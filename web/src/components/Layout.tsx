import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiPlusCircle,
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheckSquare,
  FiClock,
  FiCompass,
  FiFileText,
  FiFolder,
  FiGift,
  FiGrid,
  FiHelpCircle,
  FiLayers,
  FiMail,
  FiMenu,
  FiPaperclip,
  FiShield,
  FiStar,
  FiTag,
  FiTarget,
  FiTrendingUp,
  FiUpload,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useAuth } from '../auth/AuthContext';
import { NAV } from '../navigation';
import { TopProgress } from './feedback';
import UserMenu from './UserMenu';
import NotificationBell from './NotificationBell';
import Tutorial from './Tutorial';
import { PrimeraVisita, vistasVisitadas } from './primeraVisita';

const ICONS: Record<string, IconType> = {
  '/student': FiGrid,
  '/student/profile': FiUser,
  '/student/projects': FiFolder,
  '/student/evidences': FiPaperclip,
  '/student/affinity': FiTarget,
  '/student/recommendations': FiCompass,
  '/student/activities': FiCalendar,
  '/teacher': FiGrid,
  '/teacher/activities': FiCalendar,
  '/teacher/students': FiUser,
  '/teacher/projects': FiFolder,
  '/teacher/reports': FiBarChart2,
  '/director': FiGrid,
  '/director/approvals': FiCheckSquare,
  '/director/activities': FiCalendar,
  '/director/constancies': FiAward,
  '/director/credential-reviews': FiShield,
  '/director/affinity': FiTarget,
  '/student/collaboration': FiUsers,
  '/student/progress': FiStar,
  '/director/resources': FiBookOpen,
  '/director/trends': FiTrendingUp,
  '/society/metrics': FiBarChart2,
  '/society': FiGrid,
  '/society/activities': FiCalendar,
  '/admin': FiGrid,
  '/admin/users': FiUsers,
  '/director/analytics': FiBarChart2,
  '/society/participants': FiUsers,
  '/society/activities?nuevo=1': FiPlusCircle,
  '/admin/mail': FiMail,
  '/admin/areas': FiLayers,
  '/admin/skills': FiAward,
  '/admin/activity-categories': FiTag,
  '/admin/gamification': FiStar,
  '/teacher/recognitions': FiGift,
  '/director/recognitions': FiGift,
  '/admin/recognitions': FiGift,
  '/student/collaboration?tab=equipos': FiUsers,
  '/student/progress?tab=resumen': FiFileText,
  '/teacher/team-needs': FiUsers,
  '/teacher/my-activities': FiCalendar,
  '/admin/imports': FiUpload,
  '/admin/activities': FiCalendar,
  '/admin/resources': FiBookOpen,
  '/admin/audit': FiShield,
  '/ayuda': FiHelpCircle,
};

/**
 * Un ítem con `?tab=` (V2 §77: Equipos, CV, Preferencias) está activo solo con
 * esa pestaña; el ítem de la página está activo cuando ninguna de sus
 * pestañas con acceso propio lo está.
 */
function activo(to: string, pathname: string, search: string, hermanos: string[]): boolean {
  const [ruta, query] = to.split('?');
  if (pathname !== ruta && !(ruta.split('/').length > 2 && pathname.startsWith(`${ruta}/`))) return false;
  const actual = new URLSearchParams(search);
  if (query) {
    const pedido = new URLSearchParams(query);
    return [...pedido.entries()].every(([k, v]) => actual.get(k) === v);
  }
  return !hermanos.some((h) => {
    const [r, q] = h.split('?');
    return r === ruta && q && [...new URLSearchParams(q).entries()].every(([k, v]) => actual.get(k) === v);
  });
}

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  // En pantallas angostas el menu lateral se abre sobre el contenido. En
  // escritorio siempre esta visible y este estado no interviene.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    // Cada vista empieza arriba, como una página nueva.
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Las animaciones de entrada solo la primera vez que se abre una vista en
  // la sesión: al volver, el contenido ya está en memoria y aparece quieto.
  // Se fija al entrar a la ruta y no cambia hasta salir de ella.
  const primeraVisita = useMemo(() => !vistasVisitadas.has(location.pathname), [location.pathname]);
  useEffect(() => {
    vistasVisitadas.add(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!user) return null;
  const groups = NAV[user.role] ?? [];

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <AnimatePresence>
        {menuOpen && (
          <motion.button
            type="button"
            className="sidebar-backdrop"
            aria-label="Cerrar menú"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside className="sidebar">
        <div className="brand">
          <strong>
            <img src="/afiniaapp2Login.png" alt="Afinia" className="brand-logo" />
            Afinia
          </strong>
          <span>Perfil estudiantil dinámico</span>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
          >
            <FiX size={18} />
          </button>
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) => {
                const Icon = ICONS[item.to] ?? FiClock;
                const todos = groups.flatMap((g) => g.items.map((i) => i.to));
                const esRaiz = item.to.split('/').length <= 2;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={esRaiz}
                    className={({ isActive }) => {
                      const on = item.to.includes('?') || !esRaiz
                        ? activo(item.to, location.pathname, location.search, todos)
                        : isActive && activo(item.to, location.pathname, location.search, todos);
                      return `nav-link ${on ? 'active' : ''}`;
                    }}
                  >
                    <Icon /> {item.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        {/* La sesion vive ahora en la esquina superior derecha: este bloque
            crecia con el contenido y arrastraba el menu al desplazarse. */}
      </aside>

      <div className="main">
        <TopProgress />
        <header className="topbar">
          <div className="flex" style={{ gap: '0.7rem', minWidth: 0 }}>
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
            >
              <FiMenu size={18} />
            </button>
            <span className="page-title">{currentTitle(user.role, location.pathname)}</span>
          </div>
          <div className="flex" style={{ gap: '0.4rem' }}>
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        {/* Sin `key` ni fundido: antes cada cambio de ruta desmontaba este
            contenedor y lo volvía a montar con opacidad 0, y la página
            parpadeaba aunque sus datos ya estuvieran en memoria. */}
        <PrimeraVisita.Provider value={primeraVisita}>
          <div className="content">
            <Outlet />
          </div>
        </PrimeraVisita.Provider>
        <Tutorial />
      </div>
    </div>
  );
}

function currentTitle(role: string, path: string): string {
  if (path === '/notificaciones') return 'Notificaciones';
  for (const group of NAV[role] ?? []) {
    const match = group.items.find((i) => i.to === path);
    if (match) return match.label;
  }
  return 'Panel';
}
