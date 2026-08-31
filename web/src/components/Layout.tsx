import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiAward,
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiFolder,
  FiGrid,
  FiLayers,
  FiShield,
  FiSliders,
  FiStar,
  FiTarget,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../constants';
import { NAV } from '../navigation';

const ICONS: Record<string, IconType> = {
  '/student': FiGrid,
  '/student/profile': FiUser,
  '/student/interests': FiSliders,
  '/student/projects': FiFolder,
  '/student/affinity': FiTarget,
  '/student/activities': FiCalendar,
  '/teacher': FiGrid,
  '/teacher/activities': FiCalendar,
  '/teacher/students': FiUser,
  '/teacher/reports': FiBarChart2,
  '/director': FiGrid,
  '/director/affinity': FiTarget,
  '/society': FiGrid,
  '/society/activities': FiCalendar,
  '/admin': FiUsers,
  '/admin/roles': FiShield,
  '/admin/areas': FiLayers,
  '/admin/skills': FiAward,
  '/admin/gamification': FiStar,
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const groups = NAV[user.role] ?? [];
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong><img src="/afiniaapp2Login.png" alt="Afinia" className="brand-logo" />Afinia</strong>
          <span>Perfil estudiantil dinámico</span>
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) => {
                const Icon = ICONS[item.to] ?? FiClock;
                return item.soon ? (
                  <div key={item.label} className="nav-link disabled" title="Disponible en una próxima versión">
                    <FiClock /> {item.label}
                    <span className="soon">Próximamente</span>
                  </div>
                ) : (
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
        <div className="user-box">
          <div>{user.firstName} {user.lastName}</div>
          <div className="role">{ROLE_LABEL[user.role] ?? user.role}</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.6rem', width: '100%' }} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="page-title">{currentTitle(user.role, location.pathname)}</span>
          <div className="user-mini">
            <div className="meta">
              <b>{user.firstName} {user.lastName}</b>
              <br />
              <span>{ROLE_LABEL[user.role] ?? user.role}</span>
            </div>
            <div className="avatar">{initials}</div>
          </div>
        </header>
        <motion.div
          className="content"
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
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
