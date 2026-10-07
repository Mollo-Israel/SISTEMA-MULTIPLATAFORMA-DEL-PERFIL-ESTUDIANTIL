import { validarFormulario } from '../../components/form';
import { useEffect, useMemo, useState } from 'react';
import { enMemoria, useCachedState } from '../../hooks/viewCache';
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
  BackedSkill,
  SkillInterestKind,
  StudentProfile,
} from '../../services/types';
import { Badge, Button, Card, Diferido, PageHeader, ProgressBar, SkeletonCards, Tabs } from '../../components/ui';
import { useToast } from '../../components/feedback';
import { AreaChooser, InterestChooser, SkillInterestChooser } from '../../components/Declarations';
import QuestionnaireRunner from '../../components/QuestionnaireRunner';
import Avatar, { AvatarChooser } from '../../components/Avatar';
import StudentPrivacyPage from './Privacy';
import { useAuth } from '../../auth/AuthContext';

const AVAILABILITIES: AvailabilityStatus[] = ['looking', 'open', 'busy', 'unspecified'];
const MODES: CollaborationMode[] = ['remote', 'in_person', 'hybrid'];
const COLLAB_INTERESTS: CollaborationInterest[] = [
  'projects', 'research', 'competitions', 'study_groups', 'volunteering',
];

type Pestana = 'datos' | 'intereses' | 'disponibilidad' | 'visibilidad';

/** Enlaces antiguos que siguen funcionando: van a la pestaña que los absorbió. */
const ALIAS_PESTANA: Record<string, Pestana> = { cuestionario: 'intereses', privacidad: 'visibilidad' };

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
  const pedida = params.get('tab') ?? '';
  const tab: Pestana = (['datos', 'intereses', 'disponibilidad', 'visibilidad'] as string[]).includes(pedida)
    ? (pedida as Pestana)
    : ALIAS_PESTANA[pedida] ?? 'datos';

  // Con memoria de la sesión: al volver a «Mi perfil» se pinta al instante.
  const [profile, setProfile] = useCachedState<StudentProfile | null>('perfil', null);
  const [areas, setAreas] = useCachedState<AcademicArea[]>('areas', []);
  const [skills, setSkills] = useCachedState<Skill[]>('skills', []);
  const [loading, setLoading] = useState(() => !enMemoria('perfil'));
  const toast = useToast();
  const { user } = useAuth();
  const nombreVisible = user ? `${user.firstName} ${user.lastName}` : '';

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
          <div className="flex" style={{ gap: '0.8rem', alignItems: 'center', marginBottom: '0.6rem' }}>
            <Avatar avatarKey={profile.avatarKey} nombre={nombreVisible} size={44} />
            <strong>{nombreVisible}</strong>
          </div>
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
          { key: 'intereses', label: 'Intereses y objetivos' },
          { key: 'disponibilidad', label: 'Disponibilidad' },
          { key: 'visibilidad', label: 'Visibilidad' },
        ]}
        value={tab}
        onChange={(k) => setParams(k === 'datos' ? {} : { tab: k }, { replace: true })}
      />

      {loading ? (
        <Diferido><Card><SkeletonCards count={3} /></Card></Diferido>
      ) : tab === 'datos' ? (
        <SobreMiTab profile={profile} onSaved={(p) => setProfile(p)} />
      ) : tab === 'intereses' ? (
        <>
          <MejoraCard profile={profile} areas={areas} onSaved={(p) => setProfile(p)} />
          <InteresesTab areas={areas} skills={skills} mejora={profile?.improvementAreaIds ?? []} onSaved={recargar} />
          <CuestionarioTab />
        </>
      ) : tab === 'disponibilidad' ? (
        <DisponibilidadTab profile={profile} onSaved={(p) => setProfile(p)} />
      ) : (
        <StudentPrivacyPage embedded />
      )}
    </div>
  );
}

// ===========================================================================

/** Guarda un cambio parcial del perfil y avisa. */
function useGuardarPerfil(onSaved: (p: StudentProfile) => void) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const guardar = async (payload: Record<string, unknown>, mensaje: string) => {
    setSaving(true);
    try {
      const result = await profileService.update(payload);
      onSaved(result);
      toast.success(mensaje, `Tu perfil está al ${result.completionPercentage}%.`);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };
  return { saving, guardar };
}

function SobreMiTab({ profile, onSaved }: { profile: StudentProfile | null; onSaved: (p: StudentProfile) => void }) {
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatarKey ?? null);
  const { saving, guardar } = useGuardarPerfil(onSaved);
  if (!profile) return <SinPerfil />;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // §17.1: ni semestre ni código universitario: son institucionales.
        void guardar({ bio: bio || undefined, avatarKey: avatar }, 'Perfil guardado');
      }}
    >
      <Card title="Tu avatar">
        <p className="muted" style={{ marginTop: 0 }}>
          Elige una ilustración. No subimos fotos: así tu imagen no circula y nadie tiene que revisarla.
        </p>
        <AvatarChooser value={avatar} onChange={setAvatar} />
      </Card>
      <Card title="Sobre ti">
        <div className="field">
          <label htmlFor="perfil-bio">Cuéntanos de ti</label>
          <textarea
            id="perfil-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tus intereses y metas, en pocas palabras…"
            maxLength={1000}
          />
          <span className="field-hint">{bio.length} de 1000 caracteres</span>
        </div>
        <Button type="submit" loading={saving} icon={<FiSave size={15} />}>
          Guardar
        </Button>
      </Card>
    </form>
  );
}

function MejoraCard({
  profile,
  areas,
  onSaved,
}: {
  profile: StudentProfile | null;
  areas: AcademicArea[];
  onSaved: (p: StudentProfile) => void;
}) {
  const [mejora, setMejora] = useState<string[]>(profile?.improvementAreaIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const { saving, guardar } = useGuardarPerfil(onSaved);
  if (!profile) return <SinPerfil />;
  return (
    <Card
      title="¿En qué áreas quieres mejorar?"
      actions={
        <Button
          size="sm"
          loading={saving}
          icon={<FiSave size={14} />}
          onClick={() => {
            if (mejora.length === 0) {
              setError('Elige al menos un área donde quieras mejorar.');
              return;
            }
            setError(null);
            void guardar({ improvementAreaIds: mejora }, 'Áreas a mejorar guardadas');
          }}
        >
          Guardar áreas
        </Button>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>Te recomendaremos cursos y actividades para crecer en ellas.</p>
      <AreaChooser areas={areas} value={mejora} onChange={(v) => { setMejora(v); setError(null); }} />
      {error && <span className="field-error">{error}</span>}
    </Card>
  );
}

function DisponibilidadTab({
  profile,
  onSaved,
}: {
  profile: StudentProfile | null;
  onSaved: (p: StudentProfile) => void;
}) {
  const [form, setForm] = useState({
    availability: (profile?.availability ?? 'unspecified') as AvailabilityStatus,
    modes: profile?.collaborationPreferences?.modes ?? [],
    collabInterests: profile?.collaborationPreferences?.interests ?? [],
    hoursPerWeek: profile?.collaborationPreferences?.hoursPerWeek
      ? String(profile.collaborationPreferences.hoursPerWeek)
      : '',
    notes: profile?.collaborationPreferences?.notes ?? '',
  });
  const [errorHoras, setErrorHoras] = useState<string | null>(null);
  const { saving, guardar } = useGuardarPerfil(onSaved);
  if (!profile) return <SinPerfil />;

  const toggle = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    // V3 §67: error debajo de cada campo, no el globo del navegador.
    if (!validarFormulario(e.currentTarget as HTMLFormElement)) return;
    const horas = form.hoursPerWeek ? Number(form.hoursPerWeek) : null;
    if (horas !== null && (!Number.isInteger(horas) || horas < 1 || horas > 40)) {
      setErrorHoras('Las horas por semana van de 1 a 40.');
      return;
    }
    setErrorHoras(null);
    void guardar(
      {
        availability: form.availability,
        collaborationPreferences: {
          modes: form.modes,
          interests: form.collabInterests,
          hoursPerWeek: horas,
          notes: form.notes || null,
        },
      },
      'Disponibilidad guardada',
    );
  };

  return (
    <form noValidate onSubmit={save}>
      <Card title="Cómo te gusta trabajar">
        <div className="field">
          <span className="field-label" id="profile-buscas-con-quien-trabajar">¿Buscas con quién trabajar?</span>
          <div role="group" aria-labelledby="profile-buscas-con-quien-trabajar" className="chip-row">
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
            <span className="field-label" id="profile-modo-de-trabajo">Modo de trabajo</span>
            <div role="group" aria-labelledby="profile-modo-de-trabajo" className="chip-row">
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
            <label htmlFor="perfil-horas">Horas por semana</label>
            <input
              id="perfil-horas"
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              value={form.hoursPerWeek}
              onChange={(e) => { setForm({ ...form, hoursPerWeek: e.target.value.replace(/\D/g, '') }); setErrorHoras(null); }}
              placeholder="Por ejemplo, 8"
              aria-invalid={!!errorHoras}
            />
            {errorHoras && <span className="field-error">{errorHoras}</span>}
          </div>
        </div>
        <div className="field">
          <span className="field-label" id="profile-que-te-interesa-hacer">Qué te interesa hacer</span>
          <div role="group" aria-labelledby="profile-que-te-interesa-hacer" className="chip-row">
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
          <label htmlFor="perfil-nota">Nota para quien quiera invitarte</label>
          <input
            id="perfil-nota"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Por ejemplo, disponible por las tardes"
            maxLength={300}
          />
        </div>
        <Button type="submit" loading={saving} icon={<FiSave size={15} />}>
          Guardar disponibilidad
        </Button>
      </Card>
    </form>
  );
}

/** Sin perfil todavía: la bienvenida lo crea (OnboardingGate lleva allí). */
function SinPerfil() {
  return (
    <Card>
      <p className="muted" style={{ margin: 0 }}>
        Todavía no tienes perfil. Completa la bienvenida y vuelve aquí para ajustarlo.
      </p>
    </Card>
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
  const [intereses, setIntereses] = useCachedState<Record<string, number>>('intereses', {});
  const [tecnologias, setTecnologias] = useCachedState<Record<string, SkillInterestKind>>('tecnologias', {});
  const [respaldadas, setRespaldadas] = useCachedState<BackedSkill[]>('respaldadas', []);
  const [cargando, setCargando] = useState(() => !enMemoria('intereses'));
  const [guardandoI, setGuardandoI] = useState(false);
  const [guardandoS, setGuardandoS] = useState(false);
  const toast = useToast();

  useEffect(() => {
    profileService
      .summary()
      .then((r) => {
        setIntereses(Object.fromEntries(r.interests.map((i) => [i.academicAreaId, i.priority])));
        setTecnologias(Object.fromEntries((r.skillInterests ?? []).map((k) => [k.skillId, k.kind])));
        setRespaldadas(r.skills ?? []);
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
      await profileService.replaceSkillInterests(
        Object.entries(tecnologias).map(([skillId, kind]) => ({ skillId, kind })),
      );
      toast.success('Tecnologías guardadas.');
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
        title="Tecnologías que te interesan o quieres mejorar"
        actions={
          <Button size="sm" loading={guardandoS} onClick={guardarSkills} icon={<FiSave size={14} />}>
            Guardar tecnologías
          </Button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Nos ayudan a recomendarte cursos, charlas y compañeros. No cambian tu afinidad: esa sale de lo
          que haces y queda respaldado.
        </p>
        <h4 className="subtitle">Me interesan</h4>
        <SkillInterestChooser
          areas={areas}
          skills={skills}
          value={tecnologias}
          onChange={setTecnologias}
          kind="interest"
          destacadas={destacadas}
          alto={false}
        />
        <h4 className="subtitle">Quiero mejorar</h4>
        <SkillInterestChooser
          areas={areas}
          skills={skills}
          value={tecnologias}
          onChange={setTecnologias}
          kind="improve"
          destacadas={destacadas}
          alto={false}
        />
      </Card>
      <Card title="Tecnologías respaldadas por tu trayectoria">
        <p className="muted" style={{ marginTop: 0 }}>
          Aparecen solas cuando confirmas tu contribución en un proyecto con respaldo o cuando se confirma
          tu participación en una actividad. No se declaran: se construyen.
        </p>
        {respaldadas.length === 0 ? (
          <p className="muted">Todavía ninguna. Registra un proyecto o inscríbete en una actividad.</p>
        ) : (
          <div className="tag-chips">
            {respaldadas.map((r) => (
              <span key={r.skillId} className="tag-chip" title={r.sources.map((x) => (x === 'project' ? 'proyecto' : 'actividad')).join(' y ')}>
                {r.skill} · {r.evidenceCount}
              </span>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ===========================================================================

function CuestionarioTab() {
  const [run, setRun] = useCachedState<OnboardingRun | null>('cuestionario', null);
  const [cargando, setCargando] = useState(() => !enMemoria('cuestionario'));
  const [respondiendo, setRespondiendo] = useState(false);
  const toast = useToast();

  const cargar = () => {
    // Si ya hay algo que mostrar, se refresca sin volver al indicador.
    if (!enMemoria('cuestionario')) setCargando(true);
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
    <Card title="Cuestionario de orientación (opcional)">
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
