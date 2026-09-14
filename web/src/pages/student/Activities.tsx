import { useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckCircle,
  FiExternalLink,
  FiHeart,
  FiMapPin,
  FiSearch,
  FiTag,
  FiUserPlus,
  FiUsers,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { activityService } from '../../services';
import type { Activity } from '../../services/types';
import { useAsync } from '../../hooks/useAsync';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ResultCount,
  SearchInput,
  SkeletonCards,
  Stagger,
} from '../../components/ui';
import { useConfirm, useToast } from '../../components/feedback';
import { ACTIVITY_STATUS_LABEL, ACTIVITY_TYPE_LABEL, lbl } from '../../constants';

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

export default function StudentActivitiesPage() {
  const { data, loading, error, reload } = useAsync(() => activityService.list(), []);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'todas' | 'academica' | 'extracurricular'>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const items = data ?? [];

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return items.filter((a) => {
      if (type !== 'todas' && a.type !== type) return false;
      if (!q) return true;
      return [a.title, a.description ?? '', a.academicArea?.name ?? '', a.category?.name ?? '', a.location ?? '']
        .some((field) => normalize(field).includes(q));
    });
  }, [items, query, type]);

  const run = async (fn: () => Promise<unknown>, id: string, success: string, detail?: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(success, detail);
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const markInterest = (a: Activity) =>
    run(() => activityService.registerInterest(a.id), a.id, 'Interés registrado', `“${a.title}” quedó marcada como de tu interés.`);

  const requestSeat = async (a: Activity) => {
    const ok = await confirm({
      title: 'Solicitar inscripción',
      message: (
        <>
          Vas a solicitar un lugar en <strong>{a.title}</strong>. El responsable de la actividad
          debe aprobarlo, y tu participación solo cuenta cuando te la confirmen.
        </>
      ),
      confirmLabel: 'Solicitar inscripción',
    });
    if (!ok) return;
    run(
      () => activityService.register(a.id),
      a.id,
      'Solicitud enviada',
      'Queda pendiente de aprobación del responsable.',
    );
  };

  return (
    <div>
      <PageHeader
        title="Actividades disponibles"
        description="Marca tu interés o solicita inscripción. La participación confirmada alimenta tu perfil y tu afinidad."
      />

      <div className="filters">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar por título, área, categoría o lugar…"
        />
        <div className="chip-row">
          {([
            { key: 'todas', label: 'Todas' },
            { key: 'academica', label: 'Académicas' },
            { key: 'extracurricular', label: 'Extracurriculares' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`chip ${type === opt.key ? 'on' : ''}`}
              onClick={() => setType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <ResultCount shown={visible.length} total={items.length} noun="actividades" />
      </div>

      {loading ? (
        <SkeletonCards count={4} />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FiCalendar size={22} />}
          message="Todavía no hay actividades publicadas. Vuelve a consultar más adelante."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FiSearch size={22} />}
          message={`Ninguna actividad coincide con los filtros aplicados.`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery('');
                setType('todas');
              }}
            >
              Quitar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid cols-2">
          {visible.map((a, index) => {
            const date = formatDate(a.eventDate);
            const blocked = a.registrationBlockReason;
            const full = a.capacity != null && a.seatsLeft === 0;
            return (
              <Stagger key={a.id} index={index}>
                <Card
                  title={a.title}
                  actions={<Badge tone="bordo">{lbl(ACTIVITY_TYPE_LABEL, a.type)}</Badge>}
                >
                  <div className="activity-meta" style={{ marginTop: 0 }}>
                    <span><FiTag size={13} /> {a.category?.name ?? 'Sin categoría'}</span>
                    <span><FiCheckCircle size={13} /> {lbl(ACTIVITY_STATUS_LABEL, a.status)}</span>
                    {a.academicArea?.name && <span><FiHeart size={13} /> {a.academicArea.name}</span>}
                  </div>

                  {a.description && <p style={{ marginTop: '0.7rem' }}>{a.description}</p>}

                  <div className="activity-meta">
                    {date && <span><FiCalendar size={13} /> {date}</span>}
                    {a.location && <span><FiMapPin size={13} /> {a.location}</span>}
                    <span><FiUsers size={13} /> {a.modality}</span>
                    {a.capacity != null && (
                      <span>
                        <FiUsers size={13} />
                        {a.seatsLeft != null ? `${a.seatsLeft} de ${a.capacity} lugares` : `Cupo ${a.capacity}`}
                      </span>
                    )}
                    {a.externalUrl && (
                      <a href={a.externalUrl} target="_blank" rel="noreferrer">
                        <FiExternalLink size={13} /> Enlace
                      </a>
                    )}
                  </div>

                  {(blocked || full) && (
                    <p className="inline-note">
                      <FiAlertCircle size={13} /> {blocked ?? 'La actividad ya no tiene lugares disponibles.'}
                    </p>
                  )}

                  <div className="flex mt" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy === a.id}
                      onClick={() => markInterest(a)}
                      icon={<FiHeart size={14} />}
                    >
                      Me interesa
                    </Button>
                    <Button
                      size="sm"
                      loading={busy === a.id}
                      onClick={() => requestSeat(a)}
                      icon={<FiUserPlus size={14} />}
                    >
                      Solicitar inscripción
                    </Button>
                  </div>
                </Card>
              </Stagger>
            );
          })}
        </div>
      )}
    </div>
  );
}
