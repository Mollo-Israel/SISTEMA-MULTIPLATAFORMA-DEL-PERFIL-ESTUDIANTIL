import { useEffect, useMemo, useState } from 'react';
import { FiCalendar, FiExternalLink, FiMapPin, FiSearch, FiUsers } from 'react-icons/fi';
import { activityService, catalogService } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import {
  AsyncView, Badge, Button, Card, EmptyState, PageHeader, ResultCount, SearchInput,
  SkeletonCards, Stagger,
} from '../../components/ui';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, lbl } from '../../constants';
import type { Activity, ActivityCategoryItem } from '../../services/types';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<ActivityCategoryItem[]>([]);

  useEffect(() => {
    catalogService.activityCategories().then(setCategories).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    let list = data ?? [];
    if (type) list = list.filter((a) => a.type === type);
    if (categoryId) list = list.filter((a) => a.category?.id === categoryId);
    if (q) {
      list = list.filter((a) =>
        [a.title, a.description ?? '', a.location ?? '', a.academicArea?.name ?? '']
          .some((field) => normalize(field).includes(q)),
      );
    }
    return list;
  }, [data, type, categoryId, query]);

  const hasFilters = !!(type || categoryId || query);

  return (
    <div>
      <PageHeader
        title="Actividades del programa"
        description="La oferta vigente, para orientar a sus estudiantes. Las actividades académicas las publica el director de carrera; las extracurriculares, la sociedad científica."
      />

      <Card>
        <div className="filters">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar por título, lugar o área…"
          />
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
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setType('');
                setCategoryId('');
                setQuery('');
              }}
            >
              Limpiar filtros
            </Button>
          )}
          <ResultCount
            shown={filtered.length}
            total={(data ?? []).length}
            noun="actividades"
          />
        </div>

        <AsyncView
          loading={loading}
          error={error}
          data={data}
          skeleton={<SkeletonCards count={3} />}
          isEmpty={() => filtered.length === 0}
          empty={
            hasFilters ? (
              <EmptyState
                icon={<FiSearch size={22} />}
                message="Ninguna actividad coincide con los filtros aplicados."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setType('');
                      setCategoryId('');
                      setQuery('');
                    }}
                  >
                    Quitar filtros
                  </Button>
                }
              />
            ) : undefined
          }
          emptyMessage="Todavía no hay actividades publicadas."
        >
          {() => (
            <div className="activity-list">
              {filtered.map((a, index) => (
                <Stagger key={a.id} index={index}>
                <article className="activity-item">
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
                        <FiUsers /> {a.confirmedCount ?? 0} confirmado
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
                </Stagger>
              ))}
            </div>
          )}
        </AsyncView>
      </Card>
    </div>
  );
}
