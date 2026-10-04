import { useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { auditService, type AuditEventView } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Badge, Button, Card, PageHeader, SkeletonTable } from '../../components/ui';

const FECHA = (v: string) =>
  new Date(v).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });

/** Grupos de eventos más consultados; el filtro libre cubre el resto. */
const TIPOS: { value: string; label: string }[] = [
  { value: '', label: 'Todos los eventos' },
  { value: 'USER_PROVISIONED', label: 'Alta de cuentas' },
  { value: 'TEACHER_SCOPE_CHANGED', label: 'Cambios de alcance docente' },
  { value: 'IMPORT_APPLIED', label: 'Importaciones de padrón' },
  { value: 'ACTIVITY_APPROVED', label: 'Actividades aprobadas' },
  { value: 'ACTIVITY_REJECTED', label: 'Actividades rechazadas' },
  { value: 'PARTICIPATION_CONFIRMED', label: 'Participaciones confirmadas' },
  { value: 'CONSTANCY_ISSUED', label: 'Constancias emitidas' },
  { value: 'SKILL_CLASSIFICATION_OVERRIDE', label: 'Habilidades fuera del área sugerida' },
  { value: 'AI_SUGGESTION_ACCEPTED', label: 'Sugerencias de IA aceptadas' },
  { value: 'TEAM_NAME_MODERATED', label: 'Nombres de equipo moderados' },
  { value: 'CONFIG_CHANGED', label: 'Cambios de configuración' },
];

/**
 * Auditoría (V2 §77, §69): qué pasó, quién lo hizo y cuándo. Solo lectura y
 * solo para la Administración; el servidor ya quitó del detalle cualquier
 * dato sensible antes de guardarlo.
 */
export default function AdminAuditPage() {
  const [tipo, setTipo] = useState('');
  const [entidad, setEntidad] = useState('');
  const [aplicado, setAplicado] = useState({ tipo: '', entidad: '' });
  const state = useAsync(
    () => auditService.list({ eventType: aplicado.tipo || undefined, entityType: aplicado.entidad || undefined, limit: 200 }),
    [aplicado.tipo, aplicado.entidad],
  );

  return (
    <div>
      <PageHeader
        title="Auditoría"
        description="Eventos relevantes del sistema, del más reciente al más antiguo. El detalle nunca incluye contraseñas, tokens ni códigos."
      />
      <Card
        title="Eventos"
        actions={
          <form
            className="flex"
            style={{ gap: '0.5rem', flexWrap: 'wrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              setAplicado({ tipo, entidad: entidad.trim() });
            }}
          >
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de evento">
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              value={entidad}
              onChange={(e) => setEntidad(e.target.value)}
              placeholder="Entidad (user, activity…)"
              aria-label="Tipo de entidad"
              style={{ maxWidth: 200 }}
            />
            <Button type="submit" size="sm" variant="secondary" icon={<FiSearch size={14} />}>Filtrar</Button>
          </form>
        }
      >
        <AsyncView
          loading={state.loading}
          error={state.error}
          data={state.data}
          skeleton={<SkeletonTable rows={8} columns={4} />}
          isEmpty={(d: AuditEventView[]) => d.length === 0}
          emptyMessage="No hay eventos con ese filtro."
        >
          {(filas: AuditEventView[]) => (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Evento</th><th>Quién</th><th>Sobre</th><th>Detalle</th></tr>
                </thead>
                <tbody>
                  {filas.map((e) => (
                    <tr key={e.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{FECHA(e.createdAt)}</td>
                      <td><Badge tone="gray">{e.eventType}</Badge></td>
                      <td>{e.actor ?? <span className="muted">Sistema</span>}</td>
                      <td className="muted">{e.entityType}</td>
                      <td className="muted small" style={{ maxWidth: 320, wordBreak: 'break-word' }}>
                        {e.metadata && Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
