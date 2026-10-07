import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheck } from 'react-icons/fi';
import { notificationService, type NotificationItem } from '../services';
import { Button, EmptyState, Loading, PageHeader, Tabs } from '../components/ui';

/** Avisa a la campana de que el contador cambió. */
const avisarCampana = () => window.dispatchEvent(new Event('afinia:notificaciones'));

function cuando(fecha: string): string {
  const d = new Date(fecha);
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Centro de notificaciones (V3 §33): cada aviso dice qué pasó y adónde ir. */
export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [filtro, setFiltro] = useState<'all' | 'unread'>('all');
  const [marcando, setMarcando] = useState(false);
  const navigate = useNavigate();

  const cargar = useCallback(() => {
    notificationService.mine(filtro === 'unread').then(setItems).catch(() => setItems([]));
  }, [filtro]);
  useEffect(cargar, [cargar]);

  const abrir = async (n: NotificationItem) => {
    if (!n.readAt) {
      await notificationService.markRead(n.id).catch(() => undefined);
      avisarCampana();
    }
    if (n.link) navigate(n.link);
    else cargar();
  };

  const todas = async () => {
    setMarcando(true);
    try {
      await notificationService.markAllRead();
      avisarCampana();
      cargar();
    } finally {
      setMarcando(false);
    }
  };

  const hayNoLeidas = (items ?? []).some((n) => !n.readAt);

  return (
    <>
      <PageHeader
        title="Notificaciones"
        description="Avisos sobre tus actividades, equipos, proyectos y credenciales."
        actions={
          <Button variant="secondary" size="sm" icon={<FiCheck />} loading={marcando} disabled={!hayNoLeidas} onClick={todas}>
            Marcar todas como leídas
          </Button>
        }
      />
      <Tabs
        items={[
          { key: 'all', label: 'Todas' },
          { key: 'unread', label: 'Sin leer' },
        ]}
        value={filtro}
        onChange={(k) => setFiltro(k as 'all' | 'unread')}
      />
      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FiBell size={22} />}
          message={filtro === 'unread' ? 'No tienes avisos sin leer.' : 'Todavía no tienes notificaciones.'}
        />
      ) : (
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" className={`notif-item ${n.readAt ? '' : 'unread'}`} onClick={() => abrir(n)}>
                {!n.readAt && <span className="notif-dot" aria-label="Sin leer" />}
                <span className="notif-text">
                  <b>{n.title}</b>
                  <span>{n.body}</span>
                </span>
                <time dateTime={n.createdAt}>{cuando(n.createdAt)}</time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
