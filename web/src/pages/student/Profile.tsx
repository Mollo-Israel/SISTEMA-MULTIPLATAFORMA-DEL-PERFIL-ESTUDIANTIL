import { useEffect, useMemo, useState } from 'react';
import {
  FiCheck, FiCode, FiSmartphone, FiCpu, FiDatabase, FiWifi, FiShield, FiGitBranch, FiTrello,
  FiTarget, FiSave, FiUser, FiLock,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import {
  AVAILABILITY_LABEL,
  COLLABORATION_INTEREST_LABEL,
  COLLABORATION_MODE_LABEL,
} from '../../services/types';
import type {
  AcademicArea,
  AvailabilityStatus,
  CollaborationInterest,
  CollaborationMode,
  StudentProfile,
} from '../../services/types';

const AVAILABILITIES: AvailabilityStatus[] = ['looking', 'open', 'busy', 'unspecified'];
const MODES: CollaborationMode[] = ['remote', 'in_person', 'hybrid'];
const COLLAB_INTERESTS: CollaborationInterest[] = [
  'projects', 'research', 'competitions', 'study_groups', 'volunteering',
];
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SearchInput,
  SkeletonCards,
} from '../../components/ui';
import { useToast } from '../../components/feedback';

const AREA_ICON: Record<string, IconType> = {
  'Desarrollo Web': FiCode,
  'Desarrollo Móvil': FiSmartphone,
  'Inteligencia Artificial': FiCpu,
  'Bases de Datos': FiDatabase,
  Redes: FiWifi,
  Ciberseguridad: FiShield,
  'Ingeniería de Software': FiGitBranch,
  'Gestión de Proyectos': FiTrello,
};

const PROFILE_STATUS_LABEL: Record<string, string> = {
  incomplete: 'Incompleto',
  active: 'Activo',
  updated: 'Actualizado',
};

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [form, setForm] = useState({
    bio: '',
    improvementAreaIds: [] as string[],
    availability: 'unspecified' as AvailabilityStatus,
    modes: [] as CollaborationMode[],
    collabInterests: [] as CollaborationInterest[],
    hoursPerWeek: '',
    notes: '',
  });
  const toast = useToast();

  useEffect(() => {
    Promise.all([catalogService.areas(), profileService.getMine().catch(() => null)])
      .then(([a, p]) => {
        setAreas(a);
        if (p) {
          setProfile(p);
          setExists(true);
          setForm({
            bio: p.bio ?? '',
            improvementAreaIds: p.improvementAreaIds ?? [],
            availability: p.availability ?? 'unspecified',
            modes: p.collaborationPreferences?.modes ?? [],
            collabInterests: p.collaborationPreferences?.interests ?? [],
            hoursPerWeek: p.collaborationPreferences?.hoursPerWeek
              ? String(p.collaborationPreferences.hoursPerWeek)
              : '',
            notes: p.collaborationPreferences?.notes ?? '',
          });
        }
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAreas = useMemo(() => {
    const q = normalize(areaQuery.trim());
    if (!q) return areas;
    return areas.filter((a) => normalize(a.name).includes(q));
  }, [areas, areaQuery]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // §17.1: ni semestre ni codigo universitario. Son institucionales y el
    // servidor rechaza recibirlos de un estudiante.
    const payload = {
      bio: form.bio || undefined,
      improvementAreaIds: form.improvementAreaIds,
      availability: form.availability,
      collaborationPreferences: {
        modes: form.modes,
        interests: form.collabInterests,
        hoursPerWeek: form.hoursPerWeek ? Number(form.hoursPerWeek) : null,
        notes: form.notes || null,
      },
    };
    try {
      const result = exists ? await profileService.update(payload) : await profileService.create(payload);
      setProfile(result);
      setExists(true);
      toast.success(
        exists ? 'Perfil actualizado' : 'Perfil creado',
        `Tu completitud ahora es del ${result.completionPercentage}%.`,
      );
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = (id: string) => {
    setForm((f) => ({
      ...f,
      improvementAreaIds: f.improvementAreaIds.includes(id)
        ? f.improvementAreaIds.filter((x) => x !== id)
        : [...f.improvementAreaIds, id],
    }));
  };

  const chosen = form.improvementAreaIds.length;

  return (
    <div>
      <PageHeader
        title="Perfil dinámico"
        description="Datos declarados que, junto a tu actividad en la plataforma, alimentan tus áreas de afinidad."
      />

      {loading ? (
        <Card>
          <SkeletonCards count={3} />
        </Card>
      ) : (
        <>
          {profile && (
            <Card
              title="Completitud del perfil"
              actions={
                <Badge tone={profile.completionPercentage >= 80 ? 'green' : profile.completionPercentage >= 40 ? 'amber' : 'gray'}>
                  {PROFILE_STATUS_LABEL[profile.status] ?? profile.status}
                </Badge>
              }
            >
              <ProgressBar
                value={profile.completionPercentage}
                label="Avance de tu perfil"
                tone={profile.completionPercentage >= 80 ? 'green' : profile.completionPercentage >= 40 ? 'amber' : 'bordo'}
              />
              <p className="muted" style={{ marginTop: '0.6rem' }}>
                Se completa con tu descripción, tus áreas de preferencia, tus habilidades y las
                áreas donde quieres mejorar. El semestre lo aporta la carrera.
              </p>
            </Card>
          )}

          {profile && (
            <Card
              title="Datos institucionales"
              actions={<Badge tone="gray">No editables</Badge>}
            >
              <p className="muted" style={{ marginTop: 0 }}>
                Estos datos los aporta la carrera desde el padrón. Si alguno es incorrecto,
                avisa a la administración: no se corrigen desde aquí.
              </p>
              <div className="inst-grid">
                <div className="inst-dato">
                  <span className="lbl"><FiLock size={11} /> Semestre</span>
                  <span className="val">
                    {profile.semester ? `${profile.semester}º semestre` : 'Sin asignar'}
                  </span>
                </div>
                <div className="inst-dato">
                  <span className="lbl"><FiLock size={11} /> Código universitario</span>
                  <span className="val">{profile.universityCode ?? 'Sin asignar'}</span>
                </div>
              </div>
            </Card>
          )}

          <Card title={exists ? 'Editar perfil' : 'Crear perfil'}>
            <form onSubmit={save}>
              <div className="field">
                <label>Descripción</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Cuéntanos brevemente tus intereses y metas académicas…"
                  maxLength={1000}
                />
                <span className="field-hint">{form.bio.length} de 1000 caracteres</span>
              </div>

              <div className="field">
                <div className="flex between" style={{ marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <label style={{ margin: 0 }}>Áreas donde deseas mejorar</label>
                  <div className="flex" style={{ gap: '0.6rem' }}>
                    <Badge tone={chosen ? 'bordo' : 'gray'}>{chosen} seleccionada{chosen === 1 ? '' : 's'}</Badge>
                    <SearchInput value={areaQuery} onChange={setAreaQuery} placeholder="Buscar área…" />
                  </div>
                </div>

                {visibleAreas.length === 0 ? (
                  <EmptyState
                    icon={<FiTarget size={22} />}
                    message={`Ningún área coincide con “${areaQuery}”.`}
                    action={
                      <Button variant="secondary" size="sm" onClick={() => setAreaQuery('')}>
                        Limpiar búsqueda
                      </Button>
                    }
                  />
                ) : (
                  <div className="area-grid">
                    {visibleAreas.map((a) => {
                      const Icon = AREA_ICON[a.name] ?? FiTarget;
                      const on = form.improvementAreaIds.includes(a.id);
                      return (
                        <button
                          type="button"
                          key={a.id}
                          className={`area-opt ${on ? 'on' : ''}`}
                          onClick={() => toggleArea(a.id)}
                          aria-pressed={on}
                        >
                          <span className="ico"><Icon /></span>
                          <span className="nm">{a.name}</span>
                          <span className="chk">{on && <FiCheck size={12} />}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="field">
                <label>Disponibilidad para colaborar</label>
                <div className="chip-row">
                  {AVAILABILITIES.map((a) => (
                    <button
                      type="button"
                      key={a}
                      className={`chip ${form.availability === a ? 'on' : ''}`}
                      onClick={() => setForm({ ...form, availability: a })}
                      aria-pressed={form.availability === a}
                    >
                      {AVAILABILITY_LABEL[a]}
                    </button>
                  ))}
                </div>
                <span className="field-hint">
                  Es una señal para formar equipos, no un compromiso.
                </span>
              </div>

              <div className="row">
                <div className="field">
                  <label>Modo de trabajo</label>
                  <div className="chip-row">
                    {MODES.map((m) => {
                      const on = form.modes.includes(m);
                      return (
                        <button
                          type="button"
                          key={m}
                          className={`chip ${on ? 'on' : ''}`}
                          onClick={() => setForm({
                            ...form,
                            modes: on ? form.modes.filter((x) => x !== m) : [...form.modes, m],
                          })}
                          aria-pressed={on}
                        >
                          {COLLABORATION_MODE_LABEL[m]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="field">
                  <label>Horas por semana</label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={form.hoursPerWeek}
                    onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })}
                    placeholder="Por ejemplo, 8"
                  />
                </div>
              </div>

              <div className="field">
                <label>Qué te interesa hacer</label>
                <div className="chip-row">
                  {COLLAB_INTERESTS.map((i) => {
                    const on = form.collabInterests.includes(i);
                    return (
                      <button
                        type="button"
                        key={i}
                        className={`chip ${on ? 'on' : ''}`}
                        onClick={() => setForm({
                          ...form,
                          collabInterests: on
                            ? form.collabInterests.filter((x) => x !== i)
                            : [...form.collabInterests, i],
                        })}
                        aria-pressed={on}
                      >
                        {COLLABORATION_INTEREST_LABEL[i]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field">
                <label>Nota para quien quiera invitarte</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Por ejemplo, disponible por las tardes"
                  maxLength={300}
                />
              </div>

              <Button type="submit" loading={saving} icon={exists ? <FiSave size={15} /> : <FiUser size={15} />}>
                {exists ? 'Guardar cambios' : 'Crear perfil'}
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
