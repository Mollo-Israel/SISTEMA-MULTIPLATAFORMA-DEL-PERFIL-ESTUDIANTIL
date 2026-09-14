import { useAsync } from '../../hooks/useAsync';
import { adminService } from '../../services';
import { AsyncView, Card, PageHeader, SkeletonTable } from '../../components/ui';
import { ROLE_LABEL } from '../../constants';

export default function AdminRolesPage() {
  const { data, loading, error } = useAsync(() => adminService.roles(), []);
  return (
    <div>
      <PageHeader
        title="Roles del sistema"
        description="Catálogo de roles. La asignación se realiza al crear o editar usuarios."
      />
      <Card>
        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonTable rows={5} columns={2} />}
          isEmpty={(d: any) => d.length === 0}
        >
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
