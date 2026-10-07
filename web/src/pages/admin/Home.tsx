import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheckSquare, FiMail, FiShield, FiUpload, FiUserCheck } from 'react-icons/fi';
import { useAsync } from '../../hooks/useAsync';
import { reportService, type AdminOverview } from '../../services';
import { ROLE_LABEL } from '../../constants';
import { AsyncView, Badge, Card, PageHeader, SkeletonCards } from '../../components/ui';

const FECHA = (v: string) => new Date(v).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
const IMPORTACION: Record<string, string> = { previewed: 'Analizada, sin aplicar', applied: 'Aplicada', discarded: 'Descartada' };

/**
 * Inicio de Administración (V3 §54): cuentas por rol y lo que requiere
 * atención. Operativo; no muestra datos académicos de nadie.
 */
export default function AdminHomePage() {
  const state = useAsync(() => reportService.adminOverview(), []);
  return (
    <div>
      <PageHeader title="Inicio" description="El estado de la plataforma y lo que requiere tu atención." />
      <AsyncView loading={state.loading} error={state.error} data={state.data} skeleton={<SkeletonCards count={4} />}>
        {(o: AdminOverview) => (
          <>
            <div className="grid cols-3">
              <Atencion to="/admin/users" icon={<FiUserCheck />} n={o.attention.pendingActivation} titulo="Cuentas sin activar" detalle="Puedes reenviar la activación desde Usuarios" />
              <Atencion to="/admin/activities" icon={<FiCheckSquare />} n={o.attention.activitiesPendingReview} titulo="Actividades en revisión" detalle="Las decide Dirección" />
              <Atencion to="/admin/audit" icon={<FiShield />} n={o.attention.credentialsPendingManualReview} titulo="Credenciales en revisión manual" detalle="Las decide Dirección" />
            </div>

            <Card title="Cuentas por rol" actions={<Link to="/admin/users" className="btn btn-secondary btn-sm">Gestionar usuarios</Link>}>
              <div className="scroll-x">
                <table>
                  <thead><tr><th>Rol</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Activas</th><th style={{ textAlign: 'right' }}>Sin activar</th></tr></thead>
                  <tbody>
                    {o.users.map((u) => (
                      <tr key={u.role}>
                        <td><Link to={`/admin/users?role=${u.role}`}>{ROLE_LABEL[u.role] ?? u.role}</Link></td>
                        <td style={{ textAlign: 'right' }}>{u.total}</td>
                        <td style={{ textAlign: 'right' }}>{u.active}</td>
                        <td style={{ textAlign: 'right' }}>{u.pendingActivation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid cols-3">
              <Card title="Padrón" actions={<Link to="/admin/imports" className="btn btn-ghost btn-sm"><FiUpload size={13} /> Importar</Link>}>
                {o.lastImport
                  ? <p style={{ margin: 0 }}>Última importación: {FECHA(o.lastImport.createdAt)} · <Badge tone="gray">{IMPORTACION[o.lastImport.status] ?? o.lastImport.status}</Badge></p>
                  : <p className="muted" style={{ margin: 0 }}>Todavía no se importó ningún padrón.</p>}
              </Card>
              <Card title="Auditoría" actions={<Link to="/admin/audit" className="btn btn-ghost btn-sm">Ver</Link>}>
                <p style={{ margin: 0 }}>{o.auditEventsLast7Days} eventos en los últimos 7 días.</p>
              </Card>
              <Card title="Correo" actions={<Link to="/admin/mail" className="btn btn-ghost btn-sm"><FiMail size={13} /> Configuración</Link>}>
                <p style={{ margin: 0 }}>
                  {o.mail.mode === 'smtp'
                    ? <Badge tone="green">Envío real (SMTP)</Badge>
                    : <Badge tone="amber">Simulado: los correos no salen</Badge>}
                </p>
              </Card>
            </div>
          </>
        )}
      </AsyncView>
    </div>
  );
}

function Atencion({ to, icon, n, titulo, detalle }: { to: string; icon: React.ReactNode; n: number; titulo: string; detalle: string }) {
  return (
    <Link to={to} className={`card pendiente ${n > 0 ? 'con' : ''}`}>
      <span className="qi" aria-hidden>{icon}</span>
      <span className="pendiente-n">{n}</span>
      <strong>{titulo}</strong>
      <span className="muted">{detalle}</span>
      <span className="stat-accion">Ir <FiArrowRight size={12} /></span>
    </Link>
  );
}
