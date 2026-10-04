import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowLeft, FiArrowRight, FiAward, FiCheck, FiCompass, FiHeart, FiLogOut, FiShield, FiSkipForward,
  FiTarget, FiUser, FiUsers, FiZap,
} from 'react-icons/fi';
import { apiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { catalogService, profileService } from '../../services';
import {
  AVAILABILITY_LABEL, COLLABORATION_INTEREST_LABEL, COLLABORATION_MODE_LABEL,
} from '../../services/types';
import type {
  AcademicArea, AvailabilityStatus, CollaborationInterest, CollaborationMode, OnboardingStepKey,
  Skill, SkillInterestKind,
} from '../../services/types';
import { useToast } from '../../components/feedback';
import QuestionnaireRunner from '../../components/QuestionnaireRunner';
import { AreaChooser, InterestChooser, SkillInterestChooser } from '../../components/Declarations';
import '../../welcome.css';

const AVAILABILITIES: AvailabilityStatus[] = ['looking', 'open', 'busy', 'unspecified'];
const MODES: CollaborationMode[] = ['remote', 'in_person', 'hybrid'];
const COLLAB_INTERESTS: CollaborationInterest[] = ['projects', 'research', 'competitions', 'study_groups', 'volunteering'];

/** Los cinco pasos de la bienvenida V2 (§20.1). */
const ETAPAS: { titulo: string; icono: typeof FiUser; paso: OnboardingStepKey; resumen: string }[] = [
  { titulo: 'Tus datos', icono: FiUser, paso: 'profile', resumen: 'Confirma tu semestre y tu código.' },
  { titulo: 'Lo que te interesa', icono: FiHeart, paso: 'interests', resumen: 'Áreas y tecnologías que te llaman.' },
  { titulo: 'Lo que quieres mejorar', icono: FiTarget, paso: 'improvement', resumen: 'Dónde quieres crecer.' },
  { titulo: 'Colaboración y privacidad', icono: FiUsers, paso: 'availability', resumen: 'Cómo trabajas y qué compartes.' },
  { titulo: 'Orientación', icono: FiCompass, paso: 'questionnaire', resumen: 'Opcional: unas preguntas para afinar.' },
];
const ORDEN: OnboardingStepKey[] = ['welcome', 'profile', 'interests', 'improvement', 'availability', 'questionnaire', 'done'];

/**
 * Bienvenida del estudiante (V2 §20).
 *
 * Cinco pasos antes de ver el resto del sistema; el último es opcional. Lo
 * obligatorio (§20.2) lo exige también el servidor: confirmar los datos
 * institucionales, al menos un interés o área de mejora, decidir la
 * disponibilidad y revisar la privacidad.
 *
 * Todo lo declarado aquí orienta recomendaciones y colaboración. La afinidad
 * no sale de esta pantalla: sale de actividades confirmadas, proyectos y
 * certificados con respaldo (§21, §45.1).
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
  const [faltan, setFaltan] = useState<string[]>([]);

  const [tienePerfil, setTienePerfil] = useState(false);
  const [semestre, setSemestre] = useState<number | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [areas, setAreas] = useState<AcademicArea[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  const [bio, setBio] = useState('');
  const [intereses, setIntereses] = useState<Record<string, number>>({});
  const [mejora, setMejora] = useState<string[]>([]);
  const [tecnologias, setTecnologias] = useState<Record<string, SkillInterestKind>>({});
  const [disponibilidad, setDisponibilidad] = useState<AvailabilityStatus | null>(null);
  const [modos, setModos] = useState<CollaborationMode[]>([]);
  const [quiero, setQuiero] = useState<CollaborationInterest[]>([]);
  const [horas, setHoras] = useState(4);
  const [descubrible, setDescubrible] = useState(true);
  const [compartible, setCompartible] = useState(false);
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
        setCodigo(estado.universityCode ?? null);
        setRespondioCuestionario(estado.counts.questionnaireRuns > 0);
        setFaltan(estado.missing ?? []);

        if (estado.hasProfile) {
          const [perfil, resumen, techs] = await Promise.all([
            profileService.getMine(),
            profileService.summary().catch(() => null),
            profileService.skillInterests().catch(() => []),
          ]);
          setMejora(perfil.improvementAreaIds ?? []);
          setBio(perfil.bio ?? '');
          if (estado.availabilityDecided) setDisponibilidad(perfil.availability ?? 'unspecified');
          setModos(perfil.collaborationPreferences?.modes ?? []);
          setQuiero(perfil.collaborationPreferences?.interests ?? []);
          if (perfil.collaborationPreferences?.hoursPerWeek) setHoras(perfil.collaborationPreferences.hoursPerWeek);
          setDescubrible(perfil.peerDiscoverable ?? true);
          setCompartible(perfil.publicProfileEnabled ?? false);
          if (resumen) setIntereses(Object.fromEntries(resumen.interests.map((i) => [i.academicAreaId, i.priority])));
          setTecnologias(Object.fromEntries(techs.map((t) => [t.skillId, t.kind])));
        }
        const retomar = estado.institutionalConfirmed && ORDEN.includes(estado.step) ? estado.step : 'welcome';
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
      const propio = e instanceof Error && !(e as { isAxiosError?: boolean }).isAxiosError;
      setError(propio ? (e as Error).message : apiError(e));
    } finally {
      setGuardando(false);
    }
  };

  const guardarTecnologias = () =>
    profileService.replaceSkillInterests(
      Object.entries(tecnologias).map(([skillId, kind]) => ({ skillId, kind })),
    );

  // ------------------------------------------------------------- pasos
  const confirmarDatos = () =>
    guardar(async () => {
      const estado = await profileService.confirmInstitutional(bio.trim() || undefined);
      setTienePerfil(true);
      setFaltan(estado.missing);
    }, 'interests');

  const guardarIntereses = () =>
    guardar(async () => {
      const items = Object.entries(intereses)
        .filter(([, p]) => p > 0)
        .map(([academicAreaId, priority]) => ({ academicAreaId, priority }));
      await profileService.replaceInterests(items);
      await guardarTecnologias();
    }, 'improvement');

  const totalDeclarado =
    Object.values(intereses).filter(Boolean).length + mejora.length + Object.keys(tecnologias).length;

  const guardarMejora = () =>
    guardar(async () => {
      if (totalDeclarado === 0) {
        throw new Error('Elige al menos un interés o un área que quieras mejorar: es lo que usamos para recomendarte.');
      }
      await profileService.update({ improvementAreaIds: mejora });
      await guardarTecnologias();
    }, 'availability');

  const guardarColaboracion = () =>
    guardar(async () => {
      if (!disponibilidad) throw new Error('Elige tu disponibilidad (puedes elegir «Prefiero no decirlo»).');
      await profileService.update({
        availability: disponibilidad,
        collaborationPreferences: { modes: modos, interests: quiero, hoursPerWeek: horas, notes: null },
      });
      const estado = await profileService.onboardingPrivacy({
        peerDiscoverable: descubrible,
        publicProfileEnabled: compartible,
      });
      setFaltan(estado.missing);
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
      const estado = await profileService.onboarding().catch(() => null);
      if (estado) setFaltan(estado.missing);
      setGuardando(false);
    }
  };

  // ------------------------------------------------------------- derivados
  const nombre = user?.firstName ?? '';
  const etapaActual = ETAPAS.findIndex((e) => e.paso === paso);

  /** Las tecnologías de las áreas que ya eligió van primero. */
  const destacadas = useMemo(
    () => new Set([...Object.keys(intereses).filter((k) => intereses[k] > 0), ...mejora]),
    [intereses, mejora],
  );
  const cuenta = (k: SkillInterestKind) => Object.values(tecnologias).filter((x) => x === k).length;

  if (cargando) {
    return (
      <div className="wz-shell">
        <div className="wz-loading"><span className="qz-spinner" /> Preparando tu bienvenida…</div>
      </div>
    );
  }

  const Atras = ({ a }: { a: OnboardingStepKey }) => (
    <button type="button" className="wz-btn ghost" onClick={() => irA(a)}>
      <FiArrowLeft /> Atrás
    </button>
  );

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
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {error && <div className="wz-error" role="alert">{error}</div>}

            {/* ------------------------------------------------ bienvenida */}
            {paso === 'welcome' && (
              <div className="wz-hero">
                <motion.div
                  className="wz-hero-icon"
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                >
                  <FiZap />
                </motion.div>
                <h1>¡Hola{nombre ? `, ${nombre}` : ''}!</h1>
                <p className="lead">
                  Afinia te ayuda a encontrar cursos, charlas, actividades y compañeros que encajan
                  contigo. Para eso necesitamos conocerte un poco.
                </p>
                <div className="wz-preview">
                  {ETAPAS.map((e, i) => {
                    const Icono = e.icono;
                    return (
                      <div key={e.titulo} className="wz-preview-item">
                        <span className={`n c${i % 3}`}><Icono /></span>
                        <strong>{e.titulo}</strong>
                        <span>{e.resumen}</span>
                      </div>
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

            {/* ------------------------------------- 1 · datos institucionales */}
            {paso === 'profile' && (
              <>
                <h2>¿Son correctos tus datos?</h2>
                <p className="lead">
                  Los registró la universidad. No los puedes cambiar tú: si algo no es correcto, avisa a
                  la administración de la carrera.
                </p>
                <div className="wz-facts">
                  <div className="wz-fact"><small>Nombre</small><strong>{user ? `${user.firstName} ${user.lastName}` : '—'}</strong></div>
                  <div className="wz-fact"><small>Correo institucional</small><strong>{user?.email ?? '—'}</strong></div>
                  <div className="wz-fact"><small>Semestre</small><strong>{semestre ? `${semestre}º` : 'Sin asignar'}</strong></div>
                  <div className="wz-fact"><small>Código universitario</small><strong>{codigo ?? 'Sin asignar'}</strong></div>
                </div>
                <label className="wz-label" htmlFor="wz-bio">Cuéntanos de ti en una o dos frases <em>(opcional)</em></label>
                <textarea
                  id="wz-bio"
                  className="wz-input"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={1000}
                  placeholder="Por ejemplo: me gusta crear apps y quiero aprender más de bases de datos."
                />
                <div className="wz-actions">
                  <Atras a="welcome" />
                  <button type="button" className="wz-btn" onClick={confirmarDatos} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Mis datos son correctos'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* ------------------------------------------- 2 · lo que interesa */}
            {paso === 'interests' && (
              <>
                <h2>¿Qué te interesa?</h2>
                <p className="lead">Marca cuánto te interesa cada área. Deja en blanco las que no.</p>
                <InterestChooser areas={areas} value={intereses} onChange={setIntereses} />
                <span className="wz-label">Tecnologías que te interesan <em>(opcional)</em></span>
                <SkillInterestChooser
                  areas={areas}
                  skills={skills}
                  value={tecnologias}
                  onChange={setTecnologias}
                  kind="interest"
                  destacadas={destacadas}
                />
                <div className="wz-actions">
                  <Atras a="profile" />
                  <button type="button" className="wz-btn" onClick={guardarIntereses} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Siguiente'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* ------------------------------------------- 3 · lo que mejorar */}
            {paso === 'improvement' && (
              <>
                <h2>¿Qué quieres mejorar?</h2>
                <p className="lead">
                  Elige las áreas donde quieres crecer. Te recomendaremos cursos y actividades para ellas.
                </p>
                <AreaChooser areas={areas} value={mejora} onChange={setMejora} />
                <span className="wz-label">Tecnologías que quieres mejorar <em>(opcional)</em></span>
                <SkillInterestChooser
                  areas={areas}
                  skills={skills}
                  value={tecnologias}
                  onChange={setTecnologias}
                  kind="improve"
                  destacadas={destacadas}
                />
                <div className="wz-actions">
                  <Atras a="interests" />
                  <button type="button" className="wz-btn" onClick={guardarMejora} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Siguiente'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* ------------------------------- 4 · colaboración y privacidad */}
            {paso === 'availability' && (
              <>
                <h2>Colaboración y privacidad</h2>
                <p className="lead">Nos ayuda a sugerirte compañeros y equipos. No es un compromiso.</p>

                <span className="wz-label">¿Buscas con quién trabajar?</span>
                <div className="wz-chips" role="radiogroup" aria-label="Disponibilidad">
                  {AVAILABILITIES.map((d) => (
                    <button
                      type="button"
                      key={d}
                      role="radio"
                      className={`wz-chip ${disponibilidad === d ? 'on' : ''}`}
                      onClick={() => setDisponibilidad(d)}
                      aria-checked={disponibilidad === d}
                    >
                      {d === 'unspecified' ? 'Prefiero no decirlo' : AVAILABILITY_LABEL[d]}
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

                <span className="wz-label"><FiShield /> Tu privacidad</span>
                <label className="wz-toggle">
                  <input type="checkbox" checked={descubrible} onChange={(e) => setDescubrible(e.target.checked)} />
                  <span>
                    Aparecer como posible compañero en las sugerencias de otros estudiantes
                    <small>Solo se muestra tu nombre, semestre y lo que tu trayectoria respalda.</small>
                  </span>
                </label>
                <label className="wz-toggle">
                  <input type="checkbox" checked={compartible} onChange={(e) => setCompartible(e.target.checked)} />
                  <span>
                    Activar mi perfil compartible (enlace y QR)
                    <small>Tú eliges después qué se ve. Tu correo y tu código nunca se muestran.</small>
                  </span>
                </label>

                <div className="wz-actions">
                  <Atras a="improvement" />
                  <button type="button" className="wz-btn" onClick={guardarColaboracion} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Siguiente'} <FiArrowRight />
                  </button>
                </div>
              </>
            )}

            {/* ---------------------------------------------- 5 · orientación */}
            {paso === 'questionnaire' && !enCuestionario && (
              <div className="wz-hero small">
                <div className="wz-hero-icon alt"><FiCompass /></div>
                <h2>Orientación académica, si quieres</h2>
                <p className="lead">
                  Unas 10 preguntas sobre lo que te gusta; las primeras parten de lo que ya nos contaste.
                  No es un examen ni mide lo que sabes: te sugiere intereses y tú decides si los sumas.
                  Puedes dejarlo a medias o hacerlo más tarde desde tu perfil.
                </p>
                {respondioCuestionario && (
                  <p className="wz-pill">Ya lo respondiste antes: puedes repetirlo si quieres.</p>
                )}
                <div className="wz-actions center">
                  <Atras a="availability" />
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
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 14 }}
                >
                  <FiAward />
                </motion.div>
                <h1>¡Listo{nombre ? `, ${nombre}` : ''}!</h1>
                <p className="lead">Tu perfil ya tiene lo necesario para empezar a recomendarte cosas.</p>
                <div className="wz-summary">
                  <div><FiHeart /> <strong>{Object.values(intereses).filter(Boolean).length}</strong> área(s) de interés</div>
                  <div><FiTarget /> <strong>{mejora.length}</strong> área(s) para mejorar</div>
                  <div><FiZap /> <strong>{cuenta('interest') + cuenta('improve')}</strong> tecnología(s)</div>
                  <div><FiUsers /> {disponibilidad ? (disponibilidad === 'unspecified' ? 'Prefiero no decirlo' : AVAILABILITY_LABEL[disponibilidad]) : 'Sin decidir'}</div>
                </div>
                {faltan.length > 0 && (
                  <ul className="wz-missing" aria-label="Lo que falta">
                    {faltan.map((f) => <li key={f}>Falta {f}.</li>)}
                  </ul>
                )}
                <p className="wz-note">
                  Siguiente paso: inscríbete en una actividad o registra un proyecto. Eso es lo que va
                  construyendo tu trayectoria.
                </p>
                <div className="wz-actions center">
                  <Atras a="questionnaire" />
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
