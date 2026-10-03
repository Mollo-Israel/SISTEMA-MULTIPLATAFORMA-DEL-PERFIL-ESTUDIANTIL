import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiAward,
  FiBarChart2,
  FiTrendingUp,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiCompass,
  FiFolder,
  FiGift,
  FiGrid,
  FiLayers,
  FiMail,
  FiMenu,
  FiPaperclip,
  FiStar,
  FiTag,
  FiTarget,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useAuth } from '../auth/AuthContext';
import { NAV } from '../navigation';
import { TopProgress } from './feedback';
import UserMenu from './UserMenu';

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
  '/director/activities': FiCalendar,
  '/director/constancies': FiAward,
  '/director/affinity': FiTarget,
  '/student/collaboration': FiUsers,
  '/student/progress': FiStar,
  '/director/resources': FiBookOpen,
  '/director/trends': FiTrendingUp,
  '/society/metrics': FiBarChart2,
  '/society': FiGrid,
  '/society/activities': FiCalendar,
  '/admin': FiUsers,
  '/admin/mail': FiMail,
  '/admin/areas': FiLayers,
  '/admin/skills': FiAward,
  '/admin/activity-categories': FiTag,
  '/admin/gamification': FiStar,
  '/teacher/recognitions': FiGift,
  '/director/recognitions': FiGift,
  '/admin/recognitions': FiGift,
};

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  // En pantallas angostas el menu lateral se abre sobre el contenido. En
  // escritorio siempre esta visible y este estado no interviene.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
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
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to.split('/').length <= 2}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
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
          <UserMenu />
        </header>
        <motion.div
          className="content"
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}

function currentTitle(role: string, path: string): string {
  for (const group of NAV[role] ?? []) {
    const match = group.items.find((i) => i.to === path);
    if (match) return match.label;
  }
  return 'Panel';
}
