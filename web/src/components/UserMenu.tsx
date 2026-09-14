import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiChevronDown,
  FiExternalLink,
  FiLogOut,
  FiMail,
  FiShield,
  FiUser,
  FiX,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABEL, RolNombre } from '../constants';

/**
 * Identidad y sesion, en la esquina superior derecha.
 *
 * Antes el boton de cerrar sesion vivia al final del menu lateral. Ese bloque
 * crecia con el contenido y arrastraba la barra al desplazarse, y ademas es el
 * ultimo lugar donde alguien busca su sesion. Aqui se comporta como en
 * cualquier aplicacion: se toca el nombre y aparecen el perfil y la salida.
 */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Cierra al tocar fuera o con Escape, como cualquier menu del sistema.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`;
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;

  return (
    <div className="user-menu" ref={container}>
      <button
        type="button"
        className={`user-menu-trigger ${open ? 'on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="meta">
          <b>{fullName}</b>
          <span>{roleLabel}</span>
        </span>
        <span className="avatar">{initials}</span>
        <FiChevronDown className={`chev ${open ? 'on' : ''}`} size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="user-dropdown"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
          >
            <div className="user-dropdown-head">
              <span className="avatar lg">{initials}</span>
              <div className="who">
                <b>{fullName}</b>
                <span>{user.email}</span>
              </div>
            </div>
            <div className="user-dropdown-items">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowProfile(true);
                  setOpen(false);
                }}
              >
                <FiUser size={15} /> Mi perfil
              </button>
              <button type="button" role="menuitem" className="danger" onClick={logout}>
                <FiLogOut size={15} /> Cerrar sesión
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProfile(false)}
          >
            <motion.div
              className="modal profile-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Mi perfil"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowProfile(false)}
                aria-label="Cerrar"
              >
                <FiX size={17} />
              </button>

              <div className="profile-hero">
                <span className="avatar xl">{initials}</span>
                <h3>{fullName}</h3>
                <span className="badge badge-bordo">{roleLabel}</span>
              </div>

              <ul className="profile-rows">
                <li>
                  <span className="ico"><FiMail size={15} /></span>
                  <div>
                    <b>Correo institucional</b>
                    <span>{user.email}</span>
                  </div>
                </li>
                <li>
                  <span className="ico"><FiShield size={15} /></span>
                  <div>
                    <b>Rol en el sistema</b>
                    <span>{roleLabel}</span>
                  </div>
                </li>
                <li>
                  <span className="ico"><FiUser size={15} /></span>
                  <div>
                    <b>Estado de la cuenta</b>
                    <span>{user.status === 'active' ? 'Activa' : 'Inactiva'}</span>
                  </div>
                </li>
              </ul>

              <div className="profile-actions">
                {user.role === RolNombre.STUDENT && (
                  <Link
                    to="/student/profile"
                    className="btn btn-secondary"
                    onClick={() => setShowProfile(false)}
                  >
                    <FiExternalLink size={14} /> Ver mi perfil dinámico
                  </Link>
                )}
                <button type="button" className="btn btn-danger" onClick={logout}>
                  <FiLogOut size={14} /> Cerrar sesión
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
