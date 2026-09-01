import { useEffect, useMemo, useState } from 'react';
import { FiExternalLink, FiMapPin, FiCalendar } from 'react-icons/fi';
import { activityService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { AsyncView, Card, Badge } from '../../components/ui';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, lbl } from '../../constants';
import type { Activity, ActivityCategoryItem } from '../../services/types';

/**
 * Vista de consulta para el docente.
 *
 * La publicación de actividades corresponde al director de carrera (académicas)
 * y a la sociedad científica (extracurriculares). El docente las consulta para
 * acompañar a sus estudiantes, pero no las gestiona.
 */
export default function TeacherActivitiesPage() {
  const { data, loading, error } = useAsync<Activity[]>(() => activityService.list(), []);
  const [type, setType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<ActivityCategoryItem[]>([]);

  useEffect(() => {
    catalogService.activityCategories().then(setCategories).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let list = data ?? [];
    if (type) list = list.filter((a) => a.type === type);
    if (categoryId) list = list.filter((a) => a.category?.id === categoryId);
    return list;
  }, [data, type, categoryId]);

  return (
    <div>
      <h1>Actividades del programa</h1>
      <p className="muted">
        Consulte la oferta vigente para orientar a sus estudiantes. Las actividades académicas las
        publica el director de carrera; las extracurriculares, la sociedad científica.
      </p>

      <Card>
        <div className="filters">
          <div className="field">
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos</option>
              <option value="academica">Académica</option>
              <option value="extracurricular">Extracurricular</option>
            </select>
          </div>
          <div className="field">
            <label>Categoría</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {(type || categoryId) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setType('');
                setCategoryId('');
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <AsyncView
          loading={loading}
          error={error}
          data={data}
          isEmpty={() => filtered.length === 0}
          emptyMessage={
            type || categoryId
              ? 'Ninguna actividad coincide con los filtros aplicados.'
              : 'Todavía no hay actividades publicadas.'
          }
        >
          {() => (
            <div className="activity-list">
              {filtered.map((a) => (
                <article key={a.id} className="activity-item">
                  <div className="grow">
                    <div className="flex" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Badge tone={a.type === 'academica' ? 'bordo' : 'amber'}>
                        {lbl(ACTIVITY_TYPE_LABEL, a.type)}
                      </Badge>
                      <Badge tone="gray">{a.category?.name ?? '—'}</Badge>
                      <Badge tone="green">{lbl(ACTIVITY_STATUS_LABEL, a.status)}</Badge>
                    </div>
                    <h3 style={{ margin: '0.5rem 0 0.2rem' }}>{a.title}</h3>
                    {a.description && <p className="muted">{a.description}</p>}
                    <div className="activity-meta">
                      {a.eventDate && (
                        <span>
                          <FiCalendar />{' '}
                          {new Date(a.eventDate).toLocaleString('es-BO', {
                            day: '2-digit',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                      {a.location && (
                        <span>
                          <FiMapPin /> {a.location}
                        </span>
                      )}
                      {a.academicArea && <span>Área: {a.academicArea.name}</span>}
                      <span>
                        {a.confirmedCount ?? 0} confirmado
                        {(a.confirmedCount ?? 0) === 1 ? '' : 's'}
                        {a.capacity ? ` de ${a.capacity}` : ''}
                      </span>
                      {a.externalUrl && (
                        <a href={a.externalUrl} target="_blank" rel="noreferrer">
                          <FiExternalLink /> Enlace
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
