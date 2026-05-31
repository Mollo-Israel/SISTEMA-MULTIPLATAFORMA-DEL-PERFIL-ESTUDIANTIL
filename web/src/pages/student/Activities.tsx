import { useState } from 'react';
import { apiError } from '../../api/client';
import { activityService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { ACTIVITY_CATEGORIES } from '../../constants';

const catLabel = (v: string) => ACTIVITY_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export default function StudentActivitiesPage() {
  const { data, loading, error, reload } = useAsync(() => activityService.list(), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>, label: string) => {
    setMsg(null); setErr(null);
    try { await fn(); setMsg(label); reload(); } catch (e) { setErr(apiError(e)); }
  };

  return (
    <div>
      <h1>Actividades disponibles</h1>
      <p className="muted">Marca tu interés o inscríbete. La participación confirmada alimenta tu perfil.</p>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <AsyncView loading={loading} error={error} data={data} isEmpty={(d) => d.length === 0} emptyMessage="No hay actividades publicadas.">
        {(items) => (
          <div className="grid cols-2">
            {items.map((a) => (
              <Card key={a.id} title={a.title} actions={<Badge tone="bordo">{a.type}</Badge>}>
                <p className="muted">{catLabel(a.category)} · {a.modality} · {a.status}</p>
                {a.description && <p>{a.description}</p>}
                {a.academicArea && <p className="muted">Área: {a.academicArea.name}</p>}
                <div className="flex mt">
                  <button className="btn btn-secondary btn-sm" onClick={() => act(() => activityService.registerInterest(a.id), 'Interés registrado.')}>Me interesa</button>
                  <button className="btn btn-primary btn-sm" onClick={() => act(() => activityService.register(a.id), 'Inscripción registrada.')}>Inscribirme</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </AsyncView>
    </div>
  );
}
