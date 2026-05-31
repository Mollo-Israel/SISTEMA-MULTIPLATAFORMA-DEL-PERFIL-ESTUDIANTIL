import { useAsync } from '../../hooks/useAsync';
import { adminService } from '../../services';
import { AsyncView, Card } from '../../components/ui';
import { ROLE_LABEL } from '../../constants';

export default function AdminRolesPage() {
  const { data, loading, error } = useAsync(() => adminService.roles(), []);
  return (
    <div>
      <h1>Roles del sistema</h1>
      <p className="muted">Catálogo de roles. La asignación se realiza al crear o editar usuarios.</p>
      <Card>
        <AsyncView loading={loading} error={error} data={data} isEmpty={(d: any) => d.length === 0}>
          {(roles: any) => (
            <table>
              <thead><tr><th>Rol</th><th>Descripción</th></tr></thead>
              <tbody>
                {roles.map((r: any) => (
                  <tr key={r.id}><td>{ROLE_LABEL[r.name] ?? r.name}</td><td className="muted">{r.description}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
