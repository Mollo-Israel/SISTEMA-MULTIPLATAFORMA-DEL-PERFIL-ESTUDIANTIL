import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowLeft, FiArrowRight, FiAward, FiCheck, FiCompass, FiHeart, FiLogOut, FiSkipForward,
  FiStar, FiTarget, FiUser, FiUsers, FiZap,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { catalogService, profileService } from '../../services';
import {
  AVAILABILITY_LABEL, COLLABORATION_INTEREST_LABEL, COLLABORATION_MODE_LABEL,
} from '../../services/types';
import type {
  AcademicArea, AvailabilityStatus, CollaborationInterest, CollaborationMode, OnboardingStepKey,
  Skill, SkillLevel,
} from '../../services/types';
import { useToast } from '../../components/feedback';
import QuestionnaireRunner from '../../components/QuestionnaireRunner';
import { AreaChooser, InterestChooser, SkillChooser } from '../../components/Declarations';
import '../../welcome.css';

const AVAILABILITIES: AvailabilityStatus[] = ['looking', 'open', 'busy', 'unspecified'];
const MODES: CollaborationMode[] = ['remote', 'in_person', 'hybrid'];
const COLLAB_INTERESTS: CollaborationInterest[] = ['projects', 'research', 'competitions', 'study_groups', 'volunteering'];

/** Los tres pasos que se ven, y los pasos internos de cada uno. */
const ETAPAS: { titulo: string; icono: typeof FiUser; pasos: OnboardingStepKey[] }[] = [
  { titulo: 'Tu perfil', icono: FiUser, pasos: ['profile', 'availability'] },
  { titulo: 'Intereses y habilidades', icono: FiHeart, pasos: ['interests', 'skills'] },
  { titulo: 'Cuestionario', icono: FiCompass, pasos: ['questionnaire'] },
];
const ORDEN: OnboardingStepKey[] = ['welcome', 'profile', 'availability', 'interests', 'skills', 'questionnaire', 'done'];

/**
 * Bienvenida del estudiante: tres pasos antes de ver el resto del sistema.
 *
 * 1. **Tu perfil** — en qué áreas quiere mejorar y cómo le gusta trabajar.
 * 2. **Intereses y habilidades** — qué le interesa y qué tecnologías maneja.
 * 3. **Cuestionario** — opcional; sus preguntas se adaptan a lo declarado.
 *
 * Todo lo que se declara aquí orienta las recomendaciones de cursos, charlas y
 * actividades. Lo que el sistema da por demostrado —el respaldo— sale después
 * de proyectos, actividades confirmadas y certificados, no de esta pantalla.
 *
 * Cada paso se guarda al avanzar, así que cerrar el navegador a mitad no
 * pierde nada: la próxima vez se retoma donde quedó.
 */
export default function WelcomeWizard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState<OnboardingStepKey>('welcome');
  const [dir, setDir] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tienePerfil, setTienePerfil] = useState(false);
  const [semestre, setSemestre] = useState<number | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [mejora, setMejora] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [disponibilidad, setDisponibilidad] = useState<AvailabilityStatus>('unspecified');
  const [modos, setModos] = useState<CollaborationMode[]>([]);
  const [quiero, setQuiero] = useState<CollaborationInterest[]>([]);
  const [horas, setHoras] = useState(4);
  const [intereses, setIntereses] = useState<Record<string, number>>({});
  const [niveles, setNiveles] = useState<Record<string, SkillLevel>>({});
  const [respondioCuestionario, setRespondioCuestionario] = useState(false);
  const [enCuestionario, setEnCuestionario] = useState(false);

  // ------------------------------------------------------------- carga
  useEffect(() => {
    (async () => {
      try {
        const [estado, a, s] = await Promise.all([
          profileService.onboarding(),
          catalogService.areas(),
          catalogService.skills(),
        ]);
        if (estado.completed) {
          navigate('/student', { replace: true });
          return;
        }
        setAreas(a.filter((x) => x.isActive));
        setSkills(s.filter((x) => x.isActive));
        setTienePerfil(estado.hasProfile);
        setSemestre(estado.semester);
        setRespondioCuestionario(estado.counts.questionnaireRuns > 0);

        if (estado.hasProfile) {
          const [perfil, resumen] = await Promise.all([
            profileService.getMine(),
            profileService.summary().catch(() => null),
          ]);
          setMejora(perfil.improvementAreaIds ?? []);
          setBio(perfil.bio ?? '');
          setDisponibilidad(perfil.availability ?? 'unspecified');
          setModos(perfil.collaborationPreferences?.modes ?? []);
          setQuiero(perfil.collaborationPreferences?.interests ?? []);
          if (perfil.collaborationPreferences?.hoursPerWeek) setHoras(perfil.collaborationPreferences.hoursPerWeek);
          if (resumen) {
            setIntereses(Object.fromEntries(resumen.interests.map((i) => [i.academicAreaId, i.priority])));
            setNiveles(Object.fromEntries(resumen.skills.map((k) => [k.skillId, k.level])));
          }
        }
        const retomar = estado.claimed && ORDEN.includes(estado.step) ? estado.step : 'welcome';
        setPaso(retomar === 'done' ? 'questionnaire' : retomar);
      } catch (e) {
        setError(apiError(e));
      } finally {
        setCargando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irA = async (siguiente: OnboardingStepKey) => {
    setDir(ORDEN.indexOf(siguiente) >= ORDEN.indexOf(paso) ? 1 : -1);
    setError(null);
    setPaso(siguiente);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tienePerfil && siguiente !== 'welcome') {
      profileService.saveOnboardingStep(siguiente).catch(() => {});
    }
  };

  const guardar = async (accion: () => Promise<void>, siguiente: OnboardingStepKey) => {
    setGuardando(true);
    setError(null);
    try {
      await accion();
      await irA(siguiente);
    } catch (e) {
      // Las comprobaciones propias lanzan un Error con el mensaje listo; las
      // de la API traen el suyo en la respuesta.
      const propio = e instanceof Error && !(e as { isAxiosError?: boolean }).isAxiosError;
      setError(propio ? (e as Error).message : apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  // ------------------------------------------------------------- pasos
  const guardarPerfil = () =>
    guardar(async () => {
      if (mejora.length === 0) throw new Error('Elige al menos un área donde quieras mejorar.');
      const datos = { bio: bio.trim() || undefined, improvementAreaIds: mejora };
      if (tienePerfil) {
        const p = await profileService.update(datos);
        // Si era el perfil que creó la institución, actualizarlo lo reclama.
        if (!p) throw new Error('No se pudo guardar tu perfil.');
      } else {
        await profileService.create(datos);
        setTienePerfil(true);
      }
    }, 'availability');

  const guardarDisponibilidad = () =>
    guardar(async () => {
      await profileService.update({
        availability: disponibilidad,
        collaborationPreferences: { modes: modos, interests: quiero, hoursPerWeek: horas, notes: null },
      });
    }, 'interests');

  const guardarIntereses = () =>
    guardar(async () => {
      const items = Object.entries(intereses)
        .filter(([, p]) => p > 0)
        .map(([academicAreaId, priority]) => ({ academicAreaId, priority }));
      if (items.length === 0) throw new Error('Marca al menos un área que te interese.');
      await profileService.replaceInterests(items);
    }, 'skills');

  const guardarHabilidades = () =>
    guardar(async () => {
      await profileService.setSkills(
        Object.entries(niveles).map(([skillId, level]) => ({ skillId, level })),
      );
    }, 'questionnaire');

  const terminar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await profileService.completeOnboarding();
      toast.success('¡Bienvenido a Afinia!', 'Tu perfil ya está listo.');
      navigate('/student', { replace: true });
    } catch (e) {
      setError(apiError(e));
      setGuardando(false);
    }
  };

  // ------------------------------------------------------------- derivados
  const nombre = user?.firstName ?? '';
  const etapaActual = ETAPAS.findIndex((e) => e.pasos.includes(paso));

  /** Las habilidades de las áreas que ya eligió van primero. */
  const destacadas = useMemo(
    () => new Set([...Object.keys(intereses).filter((k) => intereses[k] > 0), ...mejora]),
    [intereses, mejora],
  );

  if (cargando) {
    return (
      <div className="wz-shell">
        <div className="wz-loading"><span className="qz-spinner" /> Preparando tu bienvenida…</div>
      </div>
    );
  }

  return (
    <div className="wz-shell">
      <div className="wz-blob b1" />
      <div className="wz-blob b2" />

      <header className="wz-header">
        <div className="wz-brand">
          <img src="/afiniaapp2Login.png" alt="" /> Afinia
        </div>
        <button type="button" className="wz-exit" onClick={logout}>
          <FiLogOut /> Salir
        </button>
      </header>

      {paso !== 'welcome' && paso !== 'done' && (
        <ol className="wz-steps" aria-label="Pasos de la bienvenida">
          {ETAPAS.map((e, i) => {
            const Icono = e.icono;
            const estado = i < etapaActual ? 'hecho' : i === etapaActual ? 'actual' : 'pendiente';
            return (
              <li key={e.titulo} className={`wz-step ${estado}`}>
                <span className="dot">{estado === 'hecho' ? <FiCheck /> : <Icono />}</span>
                <span className="lbl"><small>Paso {i + 1}</small>{e.titulo}</span>
              </li>
            );
          })}
        </ol>
      )}

      <main className="wz-main">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.section
            key={paso + (enCuestionario ? '-q' : '')}
            className="wz-card"
            custom={dir}
            initial={{ opacity: 0, x: 40 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * dir }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {error && <div className="wz-error" role="alert">{error}</div>}

            {/* ------------------------------------------------ bienvenida */}
            {paso === 'welcome' && (
              <div className="wz-hero">
                <motion.div
                  className="wz-hero-icon"
                  initial={{ scale: 0.6, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 12 }}
                >
                  <FiZap />
                </motion.div>
                <h1>¡Hola{nombre ? `, ${nombre}` : ''}!</h1>
                <p className="lead">
                  Afinia te ayuda a encontrar cursos, charlas, actividades y compañeros que encajan
                  contigo. Para eso necesitamos conocerte un poco.
                </p>
                {semestre && <p className="wz-pill">Estás en {semestre}º semestre</p>}
                <div className="wz-preview">
                  {ETAPAS.map((e, i) => {
                    const Icono = e.icono;
                    return (
                      <motion.div
                        key={e.titulo}
                        className="wz-preview-item"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.1 }}
                      >
                        <span className={`n c${i}`}><Icono /></span>
                        <strong>{e.titulo}</strong>
                        <span>
                          {i === 0 && 'Qué quieres mejorar y cómo te gusta trabajar.'}
                          {i === 1 && 'Qué te interesa y qué tecnologías manejas.'}
                          {i === 2 && 'Opcional: unas preguntas para afinar tus recomendaciones.'}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
                <p className="wz-note">Toma unos 5 minutos. Todo se guarda al avanzar y puedes cambiarlo después.</p>
                <div className="wz-actions center">
                  <button type="button" className="wz-btn big" onClick={() => irA('profile')}>
                    Empezar <FiArrowRight />
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------- áreas de mejora */}
            {paso === 'profile' && (
              <>
                <h2>¿En qué áreas quieres mejorar?</h2>
                <p className="lead">
                  Elige una o varias. Te recomendaremos cursos y actividades para crecer en ellas.
                </p>
                <AreaChooser areas={areas} value={mejora} onChange={setMejora} />
                <label className="wz-label" htmlFor="wz-bio">Cuéntanos de ti en una o dos frases <em>(opcional)</em></label>
                <textarea
                  id="wz-bio"
                  className="wz-input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  placeholder="Por ejemplo: me gusta crear apps y quiero aprender más de bases de datos."
                />
                <div className="wz-actions">
                  <button type="button" className="wz-btn ghost" onClick={() => irA('welcome')}>
                    <FiArrowLeft /> Atrás
                  </button>
                  <button type="button" className="wz-btn" onClick={guardarPerfil} disabled={guardando || mejora.length === 0}>
                    {guardando ? 'Guardando…' : 'Siguiente'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* --------------------------------------------- disponibilidad */}
            {paso === 'availability' && (
              <>
                <h2>¿Cómo te gusta trabajar?</h2>
                <p className="lead">Nos ayuda a sugerirte compañeros y equipos. No es un compromiso.</p>

                <span className="wz-label">¿Buscas con quién trabajar?</span>
                <div className="wz-chips">
                  {AVAILABILITIES.map((d) => (
                    <button
                      type="button"
                      key={d}
                      className={`wz-chip ${disponibilidad === d ? 'on' : ''}`}
                      onClick={() => setDisponibilidad(d)}
                      aria-pressed={disponibilidad === d}
                    >
                      {AVAILABILITY_LABEL[d]}
                    </button>
                  ))}
                </div>

                <span className="wz-label">¿De qué forma?</span>
                <div className="wz-chips">
                  {MODES.map((m) => {
                    const on = modos.includes(m);
                    return (
                      <button
                        type="button"
                        key={m}
                        className={`wz-chip ${on ? 'on' : ''}`}
                        onClick={() => setModos((x) => (on ? x.filter((y) => y !== m) : [...x, m]))}
                        aria-pressed={on}
                      >
                        {COLLABORATION_MODE_LABEL[m]}
                      </button>
                    );
                  })}
                </div>

                <span className="wz-label">¿Qué te gustaría hacer?</span>
                <div className="wz-chips">
                  {COLLAB_INTERESTS.map((i) => {
                    const on = quiero.includes(i);
                    return (
                      <button
                        type="button"
                        key={i}
                        className={`wz-chip ${on ? 'on' : ''}`}
                        onClick={() => setQuiero((x) => (on ? x.filter((y) => y !== i) : [...x, i]))}
                        aria-pressed={on}
                      >
                        {COLLABORATION_INTEREST_LABEL[i]}
                      </button>
                    );
                  })}
                </div>

                <label className="wz-label" htmlFor="wz-horas">
                  Horas por semana que podrías dedicar: <strong>{horas}</strong>
                </label>
                <input
                  id="wz-horas"
                  type="range"
                  min={1}
                  max={20}
                  value={horas}
                  onChange={(e) => setHoras(Number(e.target.value))}
                  className="wz-range"
                />

                <div className="wz-actions">
                  <button type="button" className="wz-btn ghost" onClick={() => irA('profile')}>
                    <FiArrowLeft /> Atrás
                  </button>
                  <button type="button" className="wz-btn" onClick={guardarDisponibilidad} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Siguiente'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* ------------------------------------------------- intereses */}
            {paso === 'interests' && (
              <>
                <h2>¿Qué áreas te interesan?</h2>
                <p className="lead">Marca cuánto te interesa cada una. Deja en blanco las que no.</p>
                <InterestChooser areas={areas} value={intereses} onChange={setIntereses} />
                <div className="wz-actions">
                  <button type="button" className="wz-btn ghost" onClick={() => irA('availability')}>
                    <FiArrowLeft /> Atrás
                  </button>
                  <button
                    type="button"
                    className="wz-btn"
                    onClick={guardarIntereses}
                    disabled={guardando || Object.values(intereses).every((p) => !p)}
                  >
                    {guardando ? 'Guardando…' : 'Siguiente'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* ----------------------------------------------- habilidades */}
            {paso === 'skills' && (
              <>
                <h2>¿Qué tecnologías manejas?</h2>
                <p className="lead">
                  Toca una tecnología y elige tu nivel. Es lo que tú declaras: más adelante, tus
                  proyectos y certificados lo irán respaldando.
                </p>
                <SkillChooser
                  areas={areas}
                  skills={skills}
                  value={niveles}
                  onChange={setNiveles}
                  destacadas={destacadas}
                />
                <div className="wz-actions">
                  <button type="button" className="wz-btn ghost" onClick={() => irA('interests')}>
                    <FiArrowLeft /> Atrás
                  </button>
                  <div className="wz-actions-right">
                    {Object.keys(niveles).length === 0 && (
                      <button type="button" className="wz-btn soft" onClick={guardarHabilidades} disabled={guardando}>
                        Todavía no manejo ninguna
                      </button>
                    )}
                    {Object.keys(niveles).length > 0 && (
                      <button type="button" className="wz-btn" onClick={guardarHabilidades} disabled={guardando}>
                        {guardando ? 'Guardando…' : `Guardar ${Object.keys(niveles).length}`} <FiArrowRight />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ---------------------------------------------- cuestionario */}
            {paso === 'questionnaire' && !enCuestionario && (
              <div className="wz-hero small">
                <div className="wz-hero-icon alt"><FiCompass /></div>
                <h2>Un cuestionario corto, si quieres</h2>
                <p className="lead">
                  Son unas 10 preguntas sobre lo que te gusta, y las primeras parten de lo que ya nos
                  contaste. No hay respuestas correctas y no es un examen: solo afina tus
                  recomendaciones. Puedes dejarlo a medias o hacerlo más tarde desde tu perfil.
                </p>
                {respondioCuestionario && (
                  <p className="wz-pill">Ya lo respondiste antes: puedes repetirlo si quieres.</p>
                )}
                <div className="wz-actions center">
                  <button type="button" className="wz-btn ghost" onClick={() => irA('skills')}>
                    <FiArrowLeft /> Atrás
                  </button>
                  <button type="button" className="wz-btn soft" onClick={() => irA('done')}>
                    <FiSkipForward /> Saltar por ahora
                  </button>
                  <button type="button" className="wz-btn" onClick={() => setEnCuestionario(true)}>
                    Responder ahora <FiArrowRight />
                  </button>
                </div>
              </div>
            )}
            {paso === 'questionnaire' && enCuestionario && (
              <QuestionnaireRunner
                onCancel={() => setEnCuestionario(false)}
                cancelLabel="Volver"
                onFinished={({ confirmed }) => {
                  setEnCuestionario(false);
                  setRespondioCuestionario(true);
                  if (confirmed > 0) toast.success('Intereses actualizados', `Sumaste ${confirmed} área(s) sugerida(s).`);
                  void irA('done');
                }}
              />
            )}

            {/* ------------------------------------------------------ listo */}
            {paso === 'done' && (
              <div className="wz-hero">
                <motion.div
                  className="wz-hero-icon ok"
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 11 }}
                >
                  <FiAward />
                </motion.div>
                <h1>¡Listo{nombre ? `, ${nombre}` : ''}!</h1>
                <p className="lead">Tu perfil ya tiene lo necesario para empezar a recomendarte cosas.</p>
                <div className="wz-summary">
                  <div><FiTarget /> <strong>{mejora.length}</strong> área(s) para mejorar</div>
                  <div><FiHeart /> <strong>{Object.values(intereses).filter(Boolean).length}</strong> interés(es)</div>
                  <div><FiZap /> <strong>{Object.keys(niveles).length}</strong> habilidad(es)</div>
                  <div><FiUsers /> {AVAILABILITY_LABEL[disponibilidad]}</div>
                </div>
                <p className="wz-note">
                  Siguiente paso: registra un proyecto o inscríbete en una actividad. Eso es lo que va
                  demostrando tus áreas fuertes.
                </p>
                <div className="wz-actions center">
                  <button type="button" className="wz-btn ghost" onClick={() => irA('questionnaire')}>
                    <FiArrowLeft /> Atrás
                  </button>
                  <button type="button" className="wz-btn big" onClick={terminar} disabled={guardando}>
                    {guardando ? 'Un momento…' : 'Ir a mi inicio'} <FiArrowRight />
                  </button>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}
