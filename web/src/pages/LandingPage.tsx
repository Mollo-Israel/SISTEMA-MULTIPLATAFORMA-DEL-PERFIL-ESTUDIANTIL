import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
} from 'framer-motion';
import {
  FiArrowRight, FiAward, FiBarChart2, FiBell, FiBookOpen, FiCalendar, FiCheck, FiCheckCircle, FiChevronDown,
  FiCompass, FiFolder, FiLogIn, FiMenu, FiShield, FiSmartphone, FiStar, FiTarget, FiUser, FiUsers, FiX,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { HOME_BY_ROLE } from '../navigation';
import '../landing.css';

/*
 * Página de inicio pública. Solo presentación: los botones llevan a las mismas
 * rutas de siempre (/login, /activar y el panel del rol).
 *
 * Movimiento: entradas al hacer scroll, «marcos» (navegador y teléfono) con
 * parallax del cursor, palabras que rotan, cinta continua, contadores y una
 * línea de pasos que se dibuja con el scroll. Con «reducir movimiento» del
 * sistema todo queda quieto y legible.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

const problems = [
  { icon: <FiFolder />, t: 'Información dispersa', d: 'Tus logros y actividades están en documentos, correos o plataformas distintas, difíciles de organizar.' },
  { icon: <FiTarget />, t: 'Falta de visibilidad', d: 'Cuesta mostrar tu verdadero potencial, habilidades y participación al postular a becas o prácticas.' },
  { icon: <FiUsers />, t: 'Oportunidades limitadas', d: 'Sin un perfil consolidado es más difícil conectar con docentes, grupos de investigación o convocatorias.' },
];

const features = [
  { icon: <FiUser />, t: 'Perfil dinámico', d: 'Construye y personaliza tu perfil académico con información siempre actualizada.' },
  { icon: <FiFolder />, t: 'Portafolio de proyectos', d: 'Documenta proyectos con tecnologías, integrantes, roles y resultados.' },
  { icon: <FiCalendar />, t: 'Actividades académicas', d: 'Registra tu participación en talleres, seminarios, retos y grupos.' },
  { icon: <FiAward />, t: 'Evidencias y certificados', d: 'Sube certificados, diplomas y evidencias que respaldan tu desarrollo.' },
  { icon: <FiTarget />, t: 'Afinidad estudiantil', d: 'Descubre tus áreas tecnológicas afines con reglas y puntuación.' },
  { icon: <FiBarChart2 />, t: 'Reportes académicos', d: 'Genera reportes y resúmenes para docentes y dirección.' },
];

const steps = [
  { icon: <FiUser />, t: 'Activa tu cuenta', d: 'La carrera la crea con tu correo institucional; tú defines la contraseña.' },
  { icon: <FiCheckCircle />, t: 'Completa tu perfil', d: 'Añade intereses, habilidades y metas.' },
  { icon: <FiFolder />, t: 'Registra y sube', d: 'Proyectos, actividades y evidencias.' },
  { icon: <FiUsers />, t: 'Participa y conecta', d: 'Inscríbete en actividades y suma participación.' },
  { icon: <FiBarChart2 />, t: 'Descubre tu afinidad', d: 'Visualiza tus áreas afines y reportes.' },
];

const faqs = [
  { q: '¿Quién puede usar la plataforma?', a: 'Estudiantes, docentes, director de carrera, sociedad científica y administradores de Ingeniería en Sistemas Informáticos.' },
  { q: '¿Reemplaza a SIU o a Teams?', a: 'No. Es una plataforma complementaria que centraliza tu información académica y extracurricular; no reemplaza notas oficiales ni la comunicación institucional.' },
  { q: '¿Qué tipo de información puedo registrar?', a: 'Intereses, habilidades, proyectos con evidencias, actividades, certificados externos y constancias internas autorizadas.' },
  { q: '¿Quién ve mi perfil y mis actividades?', a: 'Tú gestionas tu perfil. Docentes y dirección solo acceden a una vista permitida, sin datos personales sensibles ni notas.' },
  { q: '¿Cómo se calcula la afinidad?', a: 'Con reglas deterministas sobre tu trayectoria respaldada: participaciones confirmadas, proyectos con respaldo y certificados. Tus intereses orientan las recomendaciones, no la afinidad. No usa IA para decidir ni predice rendimiento.' },
  { q: '¿Hay aplicación para el celular?', a: 'Sí. Los estudiantes tienen la app móvil de Afinia; el resto de los roles trabaja desde la web, que también se adapta al teléfono.' },
];

/** Para quién es: en palabras de cada persona, sin jerga de sistema. */
const roles: { key: string; icon: ReactNode; t: string; frase: string; puntos: string[] }[] = [
  {
    key: 'estudiante', icon: <FiUser />, t: 'Estudiante',
    frase: 'Muestra lo que sabes hacer y encuentra oportunidades que van contigo.',
    puntos: ['Arma tu perfil con intereses y tecnologías', 'Guarda tus proyectos y lo que aportaste', 'Inscríbete en talleres y eventos', 'Mira cuáles son tus áreas fuertes', 'Llévalo en el bolsillo con la app móvil'],
  },
  {
    key: 'docente', icon: <FiBookOpen />, t: 'Docente',
    frase: 'Conoce a tus estudiantes por lo que hacen, no solo por sus notas.',
    puntos: ['Mira a los estudiantes de tus semestres', 'Revisa sus proyectos y respaldos', 'Publica actividades para la carrera', 'Recomienda recursos para aprender', 'Saca un reporte por semestre'],
  },
  {
    key: 'direccion', icon: <FiCompass />, t: 'Dirección de carrera',
    frase: 'Toma decisiones con una vista clara de toda la carrera.',
    puntos: ['Aprueba las actividades que se proponen', 'Revisa credenciales en casos especiales', 'Mira la participación y las tendencias', 'Define cómo se ganan los puntos', 'Da más autonomía a los docentes'],
  },
  {
    key: 'sociedad', icon: <FiStar />, t: 'Sociedad científica',
    frase: 'Organiza actividades y llega a más estudiantes.',
    puntos: ['Crea talleres, charlas y retos', 'Ve quién se inscribió', 'Confirma quién participó', 'Mide el alcance de cada actividad'],
  },
];

const cinta = ['Perfil dinámico', 'Portafolio', 'Actividades', 'Certificados', 'Afinidad', 'Equipos', 'Contacto por QR', 'Biblioteca', 'Puntos e insignias', 'Reportes', 'App móvil'];
const palabras = ['proyectos', 'actividades', 'certificados', 'afinidades'];
const cifras = [
  { n: 5, s: '', l: 'tipos de usuario' },
  { n: 6, s: '', l: 'módulos conectados' },
  { n: 2, s: '', l: 'plataformas: web y móvil' },
  { n: 0, s: '', l: 'decisiones tomadas por IA' },
];

/** Número que cuenta hasta su valor cuando aparece en pantalla. */
function Contador({ to, quieto }: { to: number; quieto: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(quieto ? to : 0);
  useEffect(() => {
    if (quieto || !ref.current) { setV(to); return; }
    let raf = 0;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const inicio = performance.now();
      const paso = (t: number) => {
        const p = Math.min(1, (t - inicio) / 1100);
        setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(paso);
      };
      raf = requestAnimationFrame(paso);
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => { obs.disconnect(); cancelAnimationFrame(raf); };
  }, [to, quieto]);
  return <span ref={ref}>{v}</span>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const quieto = !!useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(0);
  const [menu, setMenu] = useState(false);
  const [rol, setRol] = useState(roles[0].key);
  const [palabra, setPalabra] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (quieto) return;
    const id = setInterval(() => setPalabra((i) => (i + 1) % palabras.length), 2400);
    return () => clearInterval(id);
  }, [quieto]);

  // Barra de lectura arriba.
  const { scrollYProgress } = useScroll();
  const barra = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });

  // Parallax de los marcos: el cursor los inclina y el scroll los separa.
  const heroRef = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 18 });
  const sy = useSpring(my, { stiffness: 80, damping: 18 });
  const rotY = useTransform(sx, [-0.5, 0.5], [7, -7]);
  const rotX = useTransform(sy, [-0.5, 0.5], [-5, 5]);
  const flotaX = useTransform(sx, [-0.5, 0.5], [-18, 18]);
  const flotaY = useTransform(sy, [-0.5, 0.5], [-14, 14]);
  const { scrollYProgress: heroScroll } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const telefonoY = useTransform(heroScroll, [0, 1], [0, -90]);
  const navegadorY = useTransform(heroScroll, [0, 1], [0, 40]);
  const moverCursor = (e: ReactMouseEvent<HTMLElement>) => {
    if (quieto) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  // La línea de los pasos se dibuja mientras se baja.
  const pasosRef = useRef<HTMLElement>(null);
  const { scrollYProgress: pasosScroll } = useScroll({ target: pasosRef, offset: ['start 80%', 'end 60%'] });
  const linea = useSpring(pasosScroll, { stiffness: 90, damping: 22 });

  const goLogin = () => navigate('/login');
  // No hay registro público (§9): la puerta de entrada es activar la cuenta
  // que la carrera ya provisionó con el padrón institucional.
  const goActivate = () => navigate('/activar');
  const goPanel = () => navigate(user ? (HOME_BY_ROLE[user.role] ?? '/login') : '/login');
  const scrollTo = (id: string) => {
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
  };
  const enlace = (id: string, texto: string, on = false) => (
    <a href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollTo(id); }} className={on ? 'on' : undefined}>{texto}</a>
  );
  const luz = (e: ReactMouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const rolActual = roles.find((r) => r.key === rol) ?? roles[0];

  return (
    <div className="lp">
      <motion.div className="lp-progress" style={{ scaleX: barra }} aria-hidden />

      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''} ${menu ? 'abierto' : ''}`}>
        <div className="lp-brand">
          <img src="/afiniaapp.png" alt="Afinia" className="lp-logo-img" />
          <div><b>Afinia</b><small>Perfil estudiantil dinámico</small></div>
        </div>
        <div className="lp-links">
          {enlace('inicio', 'Inicio', true)}
          {enlace('funciones', 'Funciones')}
          {enlace('para-quien', 'Para quién')}
          {enlace('como', 'Cómo funciona')}
          {enlace('preguntas', 'Preguntas')}
          {user
            ? <button className="lp-btn lp-btn-solid" onClick={goPanel}>Ir a mi panel <FiArrowRight /></button>
            : <button className="lp-btn lp-btn-solid" onClick={goLogin}><FiLogIn /> Iniciar sesión</button>}
          <button type="button" className="lp-burger" onClick={() => setMenu((v) => !v)} aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menu}>
            {menu ? <FiX /> : <FiMenu />}
          </button>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.div
              className="lp-drawer"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {enlace('inicio', 'Inicio')}
              {enlace('funciones', 'Funciones')}
              {enlace('para-quien', 'Para quién')}
              {enlace('como', 'Cómo funciona')}
              {enlace('preguntas', 'Preguntas')}
              <button className="lp-btn lp-btn-outline" onClick={goActivate}><FiUser /> Activar mi cuenta</button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero */}
      <header className="lp-hero" id="inicio" ref={heroRef} onMouseMove={moverCursor} onMouseLeave={() => { mx.set(0); my.set(0); }}>
        <div className="lp-aurora" aria-hidden><span className="a1" /><span className="a2" /><span className="a3" /><span className="lp-grid-bg" /></div>
        <div className="lp-hero-grid">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.span className="lp-kpill" variants={reveal}><span className="lp-dot" /> Perfil académico dinámico</motion.span>
            <motion.h1 variants={reveal}>Construye tu <span className="accent lp-shine">perfil académico dinámico</span></motion.h1>
            <motion.div className="lp-rotador" variants={reveal}>
              Todo lo tuyo en un solo lugar:{' '}
              <span className="lp-rot-caja">
                <AnimatePresence mode="wait">
                  <motion.b
                    key={palabras[palabra]}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    {palabras[palabra]}
                  </motion.b>
                </AnimatePresence>
              </span>
            </motion.div>
            <motion.p className="sub" variants={reveal}>
              Plataforma integral para estudiantes de Ingeniería en Sistemas que centraliza tus intereses,
              habilidades, proyectos, actividades, evidencias y afinidades tecnológicas en un solo lugar.
            </motion.p>
            <motion.div className="lp-cta" variants={reveal}>
              <button className="lp-btn lp-btn-solid lp-btn-glow" onClick={goActivate}><FiUser /> Activar mi cuenta</button>
              <button className="lp-btn lp-btn-outline" onClick={() => scrollTo('funciones')}>Conocer la plataforma</button>
            </motion.div>
            <motion.div className="lp-mini" variants={reveal}>
              <div><span className="mi"><FiShield /></span> Información segura y confiable</div>
              <div><span className="mi"><FiBarChart2 /></span> Potencia tu desarrollo</div>
              <div><span className="mi"><FiUsers /></span> Conecta con oportunidades</div>
            </motion.div>
          </motion.div>

          {/* Marcos: navegador con la plataforma y teléfono con la app. */}
          <motion.div
            className="lp-stage"
            initial={{ opacity: 0, scale: 0.94, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
            style={quieto ? undefined : { rotateX: rotX, rotateY: rotY }}
          >
            <motion.div className="lp-frame-browser" style={quieto ? undefined : { y: navegadorY }}>
              <div className="lp-chrome"><i /><i /><i /><span>afinia · mi perfil</span></div>
              <img src="/img_landing.png" alt="Afinia — perfil estudiantil dinámico" className="lp-hero-img" />
              <span className="lp-scan" aria-hidden />
            </motion.div>

            <motion.div className="lp-frame-phone" style={quieto ? undefined : { y: telefonoY }} aria-hidden>
              <div className="lp-notch" />
              <div className="lp-ph-head"><b>¡Hola, Ana!</b><small>4º semestre</small></div>
              <div className="lp-ph-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" className="bg" /><circle cx="18" cy="18" r="15" className="fg" /></svg><span>80%</span></div>
              <div className="lp-ph-row"><FiFolder /> 3 proyectos</div>
              <div className="lp-ph-row"><FiCalendar /> 5 actividades</div>
              <div className="lp-ph-row"><FiAward /> 2 certificados</div>
              <div className="lp-ph-tabs"><span className="on" /><span /><span /><span /></div>
            </motion.div>

            <motion.div className="lp-float f1" style={quieto ? undefined : { x: flotaX, y: flotaY }} aria-hidden>
              <span className="fi ok"><FiCheck /></span><div><b>Participación confirmada</b><small>Taller de React</small></div>
            </motion.div>
            <motion.div className="lp-float f2" style={quieto ? undefined : { x: flotaY, y: flotaX }} aria-hidden>
              <span className="fi"><FiTarget /></span><div><b>Afinidad alta</b><small>Desarrollo web</small></div>
            </motion.div>
            <motion.div className="lp-float f3" style={quieto ? undefined : { x: flotaX, y: flotaX }} aria-hidden>
              <span className="fi bell"><FiBell /></span><div><b>Nueva actividad para ti</b><small>Hackatón de IA</small></div>
            </motion.div>
          </motion.div>
        </div>
        <button type="button" className="lp-scroll-hint" onClick={() => scrollTo('proposito')} aria-label="Bajar">
          <span /> <FiChevronDown />
        </button>
      </header>

      {/* Cinta continua */}
      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">
          {[...cinta, ...cinta].map((c, i) => <span key={i}><FiStar /> {c}</span>)}
        </div>
      </div>

      {/* Problema */}
      <section className="lp-sec" id="proposito">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={reveal}>
          <div className="lp-kick">El propósito</div>
          <h2 className="lp-h2">¿Qué problema resuelve?</h2>
          <p className="lp-lead">La información académica y extracurricular suele estar dispersa en múltiples plataformas y formatos, dificultando su gestión y aprovechamiento.</p>
        </motion.div>
        <motion.div className="lp-grid3" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.25 }} variants={stagger}>
          {problems.map((p, i) => (
            <motion.div className="lp-card lp-card-num" key={p.t} variants={reveal} data-n={`0${i + 1}`}>
              <div className="ico">{p.icon}</div>
              <h3>{p.t}</h3><p>{p.d}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Cifras */}
      <section className="lp-cifras">
        <motion.div className="in" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={stagger}>
          {cifras.map((c) => (
            <motion.div className="lp-cifra" key={c.l} variants={reveal}>
              <b><Contador to={c.n} quieto={quieto} />{c.s}</b>
              <span>{c.l}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Funciones */}
      <section className="lp-band-soft" id="funciones">
        <div className="in">
          <motion.div className="lp-center" initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal}>
            <div className="lp-kick">Funciones principales</div><h2 className="lp-h2">Todo lo que necesitas para mostrar tu valor</h2><p className="lp-lead">Seis módulos integrados que alimentan, en tiempo real, tu perfil dinámico.</p>
          </motion.div>
          <motion.div className="lp-feats" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger}>
            {features.map((f) => (
              <motion.div className="lp-card lp-spot" key={f.t} variants={reveal} onMouseMove={luz}>
                <div className="ico">{f.icon}</div>
                <h3>{f.t}</h3><p>{f.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Para quién */}
      <section className="lp-sec" id="para-quien">
        <motion.div className="lp-center" initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal}>
          <div className="lp-kick">Para quién es</div>
          <h2 className="lp-h2">Cada persona ve lo que necesita</h2>
          <p className="lp-lead">Elige tu rol y mira qué puedes hacer. Todo con palabras simples y pocos pasos.</p>
        </motion.div>
        <div className="lp-roles-tabs" role="tablist" aria-label="Roles">
          {roles.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={rol === r.key}
              className={rol === r.key ? 'on' : ''}
              onClick={() => setRol(r.key)}
            >
              {rol === r.key && <motion.span layoutId="lp-rol-pill" className="pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span className="lbl">{r.icon} {r.t}</span>
            </button>
          ))}
        </div>
        <div className="lp-role-panel">
          <AnimatePresence mode="wait">
            <motion.div
              key={rolActual.key}
              className="lp-role-body"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <div className="lp-role-txt">
                <span className="lp-role-ico">{rolActual.icon}</span>
                <h3>{rolActual.t}</h3>
                <p>{rolActual.frase}</p>
                <ul>
                  {rolActual.puntos.map((p, i) => (
                    <motion.li key={p} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i + 0.1 }}>
                      <FiCheck /> {p}
                    </motion.li>
                  ))}
                </ul>
              </div>
              <div className="lp-role-visual" aria-hidden>
                <div className="lp-mini-app">
                  <div className="bar"><i /><i /><i /></div>
                  <div className="hello">{rolActual.icon}<span>{rolActual.t}</span></div>
                  {rolActual.puntos.slice(0, 4).map((p, i) => (
                    <motion.div key={p} className="tile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i + 0.15 }}>
                      <span className={`dot d${i}`} /> {p}
                    </motion.div>
                  ))}
                  {rolActual.key === 'estudiante' && <div className="lp-movil-tag"><FiSmartphone /> También en la app móvil</div>}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="lp-band-dark" id="como" ref={pasosRef}>
        <div className="in">
          <motion.div className="lp-center" initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal}>
            <div className="lp-kick">Cómo funciona</div><h2 className="lp-h2">Tu camino en 5 pasos</h2>
          </motion.div>
          <div className="lp-steps">
            <div className="lp-track" aria-hidden><motion.span style={{ scaleX: quieto ? 1 : linea }} /></div>
            {steps.map((s, i) => (
              <motion.div
                className="lp-step"
                key={s.t}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.12, duration: 0.55, ease: EASE }}
                whileHover={quieto ? undefined : { y: -10 }}
              >
                <div className="n">{i + 1}</div>
                <div className="ci">{s.icon}</div>
                <h4>{s.t}</h4><p>{s.d}</p>
                <span className="glow" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Institucional */}
      <section className="lp-inst">
        <motion.div className="in" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={reveal}>
          <div className="logos"><span className="lg">SIU</span><span className="lg">Teams</span></div>
          <div>
            <h3>Complementa las herramientas institucionales</h3>
            <p>Afinia no reemplaza a SIU ni a Teams. Centraliza tu información académica y extracurricular para potenciar tu desarrollo.</p>
          </div>
          <ul>
            <li><FiCheck /> No sustituye procesos oficiales</li>
            <li><FiCheck /> No reemplaza la comunicación en Teams</li>
            <li><FiCheck /> Integra y organiza tu información</li>
            <li><FiCheck /> Fomenta tu crecimiento académico</li>
          </ul>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="lp-sec" id="preguntas">
        <div className="lp-center"><div className="lp-kick">Preguntas frecuentes</div><h2 className="lp-h2">Resolvemos tus dudas</h2></div>
        <motion.div className="lp-faq" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger}>
          {faqs.map((f, i) => (
            <motion.div className={`lp-q ${open === i ? 'open' : ''}`} key={f.q} variants={reveal}>
              <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{f.q} <FiChevronDown /></button>
              <motion.div className="a" initial={false} animate={{ height: open === i ? 'auto' : 0, paddingBottom: open === i ? '1rem' : 0 }} transition={{ duration: 0.25 }}>
                {f.a}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="lp-band">
        <span className="lp-band-orb o1" aria-hidden /><span className="lp-band-orb o2" aria-hidden />
        <motion.div className="in" initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={reveal}>
          <div><h2>Potencia tu perfil. Conecta con oportunidades.</h2><p>Empieza hoy a construir tu perfil académico y profesional.</p></div>
          <div className="lp-cta">
            <button className="lp-btn lp-btn-light" onClick={goActivate}><FiUser /> Activar mi cuenta</button>
            <button className="lp-btn lp-btn-outline" onClick={goLogin} style={{ background: 'transparent', borderColor: '#fff', color: '#fff' }}><FiLogIn /> Iniciar sesión</button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="in">
          <div className="fbrand">
            <div className="lp-brand" style={{ marginBottom: '0.6rem' }}><img src="/afiniaapp.png" alt="Afinia" className="lp-logo-img" /><div><b style={{ color: '#fff' }}>Afinia</b></div></div>
            <p>La plataforma que construye tu perfil estudiantil dinámico.</p>
          </div>
          <div>
            <h5>Enlaces rápidos</h5>
            {enlace('inicio', 'Inicio')}
            {enlace('funciones', 'Funciones')}
            {enlace('como', 'Cómo funciona')}
            {enlace('preguntas', 'Preguntas frecuentes')}
          </div>
          <div>
            <h5>Contacto</h5>
            <p>hola@afinia.app</p>
            <p>Soporte Afinia</p>
          </div>
          <div>
            <h5>Síguenos</h5>
            <div className="social"><span><FiBell /></span><span><FiUsers /></span><span><FiAward /></span></div>
          </div>
        </div>
        <div className="bottom">© Afinia · Perfil estudiantil dinámico</div>
      </footer>
    </div>
  );
}
