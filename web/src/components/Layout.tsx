import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL } from '../constants';
import { NAV } from '../navigation';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;
  const groups = NAV[user.role] ?? [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Perfil Estudiantil</strong>
          <span>Ingeniería en Sistemas · Univalle</span>
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.section}>
              <div className="nav-section">{group.section}</div>
              {group.items.map((item) =>
                item.soon ? (
                  <div key={item.label} className="nav-link disabled" title="Disponible en una próxima versión">
                    {item.label}
                    <span className="soon">Próximamente</span>
                  </div>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to.split('/').length <= 2}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ),
              )}
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
          <span className="muted">{ROLE_LABEL[user.role] ?? user.role}</span>
        </header>
        <div className="content">
          <Outlet />
        </div>
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
