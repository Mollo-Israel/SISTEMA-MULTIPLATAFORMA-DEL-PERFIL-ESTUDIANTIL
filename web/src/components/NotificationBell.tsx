import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { notificationService } from '../services';

const INTERVALO_MS = 60_000;

/**
 * Campana de la barra superior (V3 §33): solo el número de no leídas.
 *
 * Se consulta al entrar, al cambiar de página y cada minuto, y deja de
 * preguntar con la pestaña oculta: nadie mira una campana que no ve.
 */
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  const refrescar = useCallback(() => {
    if (document.hidden) return;
    notificationService.unreadCount().then((r) => setUnread(r.unread)).catch(() => undefined);
  }, []);

  useEffect(refrescar, [refrescar, location.pathname]);
  useEffect(() => {
    const id = window.setInterval(refrescar, INTERVALO_MS);
    const alVolver = () => refrescar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('afinia:notificaciones', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('afinia:notificaciones', alVolver);
    };
  }, [refrescar]);

  const etiqueta = unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones';
  return (
    <Link to="/notificaciones" className="notif-bell" aria-label={etiqueta} title={etiqueta}>
      <FiBell size={18} aria-hidden />
      {unread > 0 && <span className="notif-count" aria-hidden>{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}
