import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiCompass, FiLock, FiRefreshCw, FiSave } from 'react-icons/fi';
import { apiError } from '../../api/client';
import { catalogService, onboardingService, profileService } from '../../services';
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
  OnboardingRun,
  Skill,
  SkillLevel,
  StudentProfile,
} from '../../services/types';
import { Badge, Button, Card, PageHeader, ProgressBar, SkeletonCards, Tabs } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { AreaChooser, InterestChooser, SkillChooser } from '../../components/Declarations';
import QuestionnaireRunner from '../../components/QuestionnaireRunner';

const AVAILABILITIES: AvailabilityStatus[] = ['looking', 'open', 'busy', 'unspecified'];
const MODES: CollaborationMode[] = ['remote', 'in_person', 'hybrid'];
const COLLAB_INTERESTS: CollaborationInterest[] = [
  'projects', 'research', 'competitions', 'study_groups', 'volunteering',
];

type Pestana = 'datos' | 'intereses' | 'cuestionario';

/**
 * Mi perfil: todo lo que el estudiante declara de sí mismo, en un solo sitio.
 *
 * Antes eran tres pantallas sueltas —perfil, intereses y habilidades, y
 * orientación académica—. Son la misma cosa vista por partes: lo que el
 * estudiante dice de sí, que orienta sus recomendaciones. Lo que el sistema
 * da por demostrado sale de proyectos, actividades y certificados.
 */
export default function StudentProfilePage() {
  const [params, setParams] = useSearchParams();
  const tab = (['datos', 'intereses', 'cuestionario'].includes(params.get('tab') ?? '')
    ? params.get('tab')
    : 'datos') as Pestana;

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const recargar = async () => {
    const p = await profileService.getMine().catch(() => null);
    setProfile(p);
  };

  useEffect(() => {
    Promise.all([catalogService.areas(), catalogService.skills(), profileService.getMine().catch(() => null)])
      .then(([a, s, p]) => {
        setAreas(a.filter((x) => x.isActive));
        setSkills(s.filter((x) => x.isActive));
        setProfile(p);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Mi perfil"
        description="Lo que cuentas de ti: qué quieres mejorar, qué te interesa y qué sabes hacer. Con esto te recomendamos cursos, charlas y actividades."
      />
      {profile && (
        <Card
          title="Tu perfil va así"
          actions={<Badge tone={profile.completionPercentage >= 80 ? 'green' : 'amber'}>{profile.completionPercentage}%</Badge>}
        >
          <ProgressBar
            value={profile.completionPercentage}
            label="Completitud"
            tone={profile.completionPercentage >= 80 ? 'green' : profile.completionPercentage >= 40 ? 'amber' : 'bordo'}
          />
          <div className="inst-grid" style={{ marginTop: '0.8rem' }}>
            <div className="inst-dato">
              <span className="lbl"><FiLock size={11} /> Semestre</span>
              <span className="val">{profile.semester ? `${profile.semester}º semestre` : 'Pendiente de la administración'}</span>
            </div>
            <div className="inst-dato">
              <span className="lbl"><FiLock size={11} /> Código universitario</span>
              <span className="val">{profile.universityCode ?? 'Sin asignar'}</span>
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            El semestre y el código los registra la universidad. Si alguno está mal, avisa a la administración.
          </p>
        </Card>
      )}

      <Tabs
        items={[
          { key: 'datos', label: 'Sobre mí' },
          { key: 'intereses', label: 'Intereses y habilidades' },
          { key: 'cuestionario', label: 'Cuestionario de orientación' },
        ]}
        value={tab}
        onChange={(k) => setParams(k === 'datos' ? {} : { tab: k }, { replace: true })}
      />

      {loading ? (
        <Card><SkeletonCards count={3} /></Card>
      ) : tab === 'datos' ? (
        <DatosTab profile={profile} areas={areas} onSaved={(p) => setProfile(p)} />
      ) : tab === 'intereses' ? (
        <InteresesTab areas={areas} skills={skills} mejora={profile?.improvementAreaIds ?? []} onSaved={recargar} />
      ) : (
        <CuestionarioTab />
      )}
    </div>
  );
}

// ===========================================================================

function DatosTab({
  profile,
  areas,
  onSaved,
}: {
  profile: StudentProfile | null;
  areas: AcademicArea[];
  onSaved: (p: StudentProfile) => void;
}) {
  const [form, setForm] = useState({
    bio: profile?.bio ?? '',
    improvementAreaIds: profile?.improvementAreaIds ?? [],
    availability: (profile?.availability ?? 'unspecified') as AvailabilityStatus,
    modes: profile?.collaborationPreferences?.modes ?? [],
    collabInterests: profile?.collaborationPreferences?.interests ?? [],
    hoursPerWeek: profile?.collaborationPreferences?.hoursPerWeek
      ? String(profile.collaborationPreferences.hoursPerWeek)
      : '',
    notes: profile?.collaborationPreferences?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.improvementAreaIds.length === 0) {
      toast.error('Elige al menos un área donde quieras mejorar.');
      return;
    }
    const horas = form.hoursPerWeek ? Number(form.hoursPerWeek) : null;
    if (horas !== null && (!Number.isInteger(horas) || horas < 1 || horas > 40)) {
      toast.error('Las horas por semana van de 1 a 40.');
      return;
    }
    setSaving(true);
    // §17.1: ni semestre ni código universitario: son institucionales.
    const payload = {
      bio: form.bio || undefined,
      improvementAreaIds: form.improvementAreaIds,
      availability: form.availability,
      collaborationPreferences: {
        modes: form.modes,
        interests: form.collabInterests,
        hoursPerWeek: horas,
        notes: form.notes || null,
      },
    };
    try {
      const result = profile ? await profileService.update(payload) : await profileService.create(payload);
      onSaved(result);
      toast.success('Perfil guardado', `Tu perfil está al ${result.completionPercentage}%.`);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggle = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  return (
    <form onSubmit={save}>
      <Card title="¿En qué áreas quieres mejorar?">
        <p className="muted" style={{ marginTop: 0 }}>Te recomendaremos cursos y actividades para crecer en ellas.</p>
        <AreaChooser
          areas={areas}
          value={form.improvementAreaIds}
          onChange={(v) => setForm({ ...form, improvementAreaIds: v })}
        />
      </Card>

      <Card title="Sobre ti">
        <div className="field">
          <label>Cuéntanos de ti</label>
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Tus intereses y metas, en pocas palabras…"
            maxLength={1000}
          />
          <span className="field-hint">{form.bio.length} de 1000 caracteres</span>
        </div>
      </Card>

      <Card title="Cómo te gusta trabajar">
        <div className="field">
          <label>¿Buscas con quién trabajar?</label>
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
        </div>
        <div className="row">
          <div className="field">
            <label>Modo de trabajo</label>
            <div className="chip-row">
              {MODES.map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`chip ${form.modes.includes(m) ? 'on' : ''}`}
                  onClick={() => setForm({ ...form, modes: toggle(form.modes, m) })}
                  aria-pressed={form.modes.includes(m)}
                >
                  {COLLABORATION_MODE_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Horas por semana</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              value={form.hoursPerWeek}
              onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value.replace(/\D/g, '') })}
              placeholder="Por ejemplo, 8"
            />
          </div>
        </div>
        <div className="field">
          <label>Qué te interesa hacer</label>
          <div className="chip-row">
            {COLLAB_INTERESTS.map((i) => (
              <button
                type="button"
                key={i}
                className={`chip ${form.collabInterests.includes(i) ? 'on' : ''}`}
                onClick={() => setForm({ ...form, collabInterests: toggle(form.collabInterests, i) })}
                aria-pressed={form.collabInterests.includes(i)}
              >
                {COLLABORATION_INTEREST_LABEL[i]}
              </button>
            ))}
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
        <Button type="submit" loading={saving} icon={<FiSave size={15} />}>
          Guardar cambios
        </Button>
      </Card>
    </form>
  );
}

// ===========================================================================

function InteresesTab({
  areas,
  skills,
  mejora,
  onSaved,
}: {
  areas: AcademicArea[];
  skills: Skill[];
  mejora: string[];
  onSaved: () => void;
}) {
  const [intereses, setIntereses] = useState<Record<string, number>>({});
  const [niveles, setNiveles] = useState<Record<string, SkillLevel>>({});
  const [cargando, setCargando] = useState(true);
  const [guardandoI, setGuardandoI] = useState(false);
  const [guardandoS, setGuardandoS] = useState(false);
  const toast = useToast();

  useEffect(() => {
    profileService
      .summary()
      .then((r) => {
        setIntereses(Object.fromEntries(r.interests.map((i) => [i.academicAreaId, i.priority])));
        setNiveles(Object.fromEntries(r.skills.map((k) => [k.skillId, k.level])));
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const destacadas = useMemo(
    () => new Set([...Object.keys(intereses).filter((k) => intereses[k] > 0), ...mejora]),
    [intereses, mejora],
  );

  const guardarIntereses = async () => {
    setGuardandoI(true);
    try {
      // Reemplazo completo: lo que se desmarca se quita. Antes solo se
      // añadía o actualizaba, y un interés ya no se podía retirar.
      await profileService.replaceInterests(
        Object.entries(intereses)
          .filter(([, p]) => p > 0)
          .map(([academicAreaId, priority]) => ({ academicAreaId, priority })),
      );
      toast.success('Intereses guardados.');
      onSaved();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardandoI(false);
    }
  };

  const guardarSkills = async () => {
    setGuardandoS(true);
    try {
      await profileService.setSkills(Object.entries(niveles).map(([skillId, level]) => ({ skillId, level })));
      toast.success('Habilidades guardadas.');
      onSaved();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setGuardandoS(false);
    }
  };

  if (cargando) return <Card><SkeletonCards count={3} /></Card>;

  return (
    <>
      <Card
        title="¿Qué áreas te interesan?"
        actions={
          <Button size="sm" loading={guardandoI} onClick={guardarIntereses} icon={<FiSave size={14} />}>
            Guardar intereses
          </Button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>Marca cuánto te interesa cada una. Toca de nuevo para quitarla.</p>
        <InterestChooser areas={areas} value={intereses} onChange={setIntereses} />
      </Card>
      <Card
        title="¿Qué tecnologías manejas?"
        actions={
          <Button size="sm" loading={guardandoS} onClick={guardarSkills} icon={<FiSave size={14} />}>
            Guardar habilidades
          </Button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Es lo que tú declaras. Tus proyectos, actividades y certificados lo irán respaldando.
        </p>
        <SkillChooser
          areas={areas}
          skills={skills}
          value={niveles}
          onChange={setNiveles}
          destacadas={destacadas}
          alto={false}
        />
      </Card>
    </>
  );
}

// ===========================================================================

function CuestionarioTab() {
  const [run, setRun] = useState<OnboardingRun | null>(null);
  const [cargando, setCargando] = useState(true);
  const [respondiendo, setRespondiendo] = useState(false);
  const toast = useToast();

  const cargar = () => {
    setCargando(true);
    onboardingService
      .current()
      .then((r) => setRun(r.run))
      .catch(() => setRun(null))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  if (respondiendo) {
    return (
      <Card>
        <QuestionnaireRunner
          onCancel={() => setRespondiendo(false)}
          onFinished={({ confirmed }) => {
            setRespondiendo(false);
            toast.success('Cuestionario guardado', confirmed > 0 ? `Sumaste ${confirmed} área(s) a tus intereses.` : undefined);
            cargar();
          }}
        />
      </Card>
    );
  }

  return (
    <Card title="Cuestionario de orientación">
      <p className="muted" style={{ marginTop: 0 }}>
        Unas 10 preguntas sobre lo que te gusta; las primeras se adaptan a las áreas que declaraste. No es
        un examen: solo afina tus recomendaciones. Puedes repetirlo cuando quieras.
      </p>
      {cargando ? (
        <SkeletonCards count={1} />
      ) : run ? (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem' }}>
            Lo respondiste el {new Date(run.createdAt).toLocaleDateString('es-BO', { dateStyle: 'long' })}. Te sugirió:
          </p>
          <div className="tag-preview" style={{ margin: 0 }}>
            {run.suggestedAreas.length === 0
              ? <span className="muted">ninguna área en particular</span>
              : run.suggestedAreas.map((a) => <span key={a.academicAreaId} className="tag-chip">{a.name}</span>)}
          </div>
        </div>
      ) : (
        <p className="muted">Todavía no lo respondiste.</p>
      )}
      <Button
        onClick={() => setRespondiendo(true)}
        icon={run ? <FiRefreshCw size={15} /> : <FiCompass size={15} />}
      >
        {run ? 'Responder de nuevo' : 'Responder ahora'}
      </Button>
    </Card>
  );
}
