import { useEffect, useMemo, useState } from 'react';
import {
  FiCheck, FiCode, FiSmartphone, FiCpu, FiDatabase, FiWifi, FiShield, FiGitBranch, FiTrello,
  FiTarget, FiSave, FiUser,
} from 'react-icons/fi';
import type { IconType } from 'react-icons';
import { apiError } from '../../api/client';
import { catalogService, profileService } from '../../services';
import type { AcademicArea, StudentProfile } from '../../services/types';
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
  const [form, setForm] = useState({ semester: '', bio: '', improvementAreaIds: [] as string[] });
  const toast = useToast();

  useEffect(() => {
    Promise.all([catalogService.areas(), profileService.getMine().catch(() => null)])
      .then(([a, p]) => {
        setAreas(a);
        if (p) {
          setProfile(p);
          setExists(true);
          setForm({
            semester: p.semester ? String(p.semester) : '',
            bio: p.bio ?? '',
            improvementAreaIds: p.improvementAreaIds ?? [],
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
    const payload = {
      semester: form.semester ? Number(form.semester) : undefined,
      bio: form.bio || undefined,
      improvementAreaIds: form.improvementAreaIds,
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
                Se completa al declarar semestre, descripción, áreas de preferencia, habilidades y
                áreas donde quieres mejorar.
              </p>
            </Card>
          )}

          <Card title={exists ? 'Editar perfil' : 'Crear perfil'}>
            <form onSubmit={save}>
              <div className="row">
                <div className="field">
                  <label>Semestre</label>
                  <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                    <option value="">Selecciona…</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>{n}º semestre</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: 2 }} />
              </div>

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
