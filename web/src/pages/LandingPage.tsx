import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowRight, FiAward, FiBarChart2, FiCalendar, FiCheck, FiCheckCircle, FiChevronDown,
  FiFolder, FiLogIn, FiShield, FiTarget, FiUser, FiUsers, FiBell,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { HOME_BY_ROLE } from '../navigation';
import '../landing.css';

const reveal = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };
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
  { icon: <FiUser />, t: 'Crea tu cuenta', d: 'Regístrate como estudiante en segundos.' },
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
  { q: '¿Cómo se calcula la afinidad?', a: 'Con reglas, etiquetas y puntuación sobre tus intereses, habilidades, proyectos, evidencias y participación. No usa IA generativa ni predice rendimiento.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goLogin = () => navigate('/login');
  const goRegister = () => navigate('/login?registro=1');
  const goPanel = () => navigate(user ? (HOME_BY_ROLE[user.role] ?? '/login') : '/login');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="lp">
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-brand">
          <img src="/afiniaapp.png" alt="Afinia" className="lp-logo-img" />
          <div><b>Afinia</b><small>Perfil estudiantil dinámico</small></div>
        </div>
        <div className="lp-links">
          <a onClick={() => scrollTo('inicio')} className="on">Inicio</a>
          <a onClick={() => scrollTo('funciones')}>Funciones</a>
          <a onClick={() => scrollTo('como')}>Cómo funciona</a>
          <a onClick={() => scrollTo('preguntas')}>Preguntas</a>
          {user
            ? <button className="lp-btn lp-btn-solid" onClick={goPanel}>Ir a mi panel <FiArrowRight /></button>
            : <button className="lp-btn lp-btn-solid" onClick={goLogin}><FiLogIn /> Iniciar sesión</button>}
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero" id="inicio">
        <div className="lp-hero-grid">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.span className="lp-kpill" variants={reveal}><FiTarget /> Perfil académico dinámico</motion.span>
            <motion.h1 variants={reveal}>Construye tu <span className="accent">perfil académico dinámico</span></motion.h1>
            <motion.p className="sub" variants={reveal}>
              Plataforma integral para estudiantes de Ingeniería en Sistemas que centraliza tus intereses,
              habilidades, proyectos, actividades, evidencias y afinidades tecnológicas en un solo lugar.
            </motion.p>
            <motion.div className="lp-cta" variants={reveal}>
              <button className="lp-btn lp-btn-solid" onClick={goRegister}><FiUser /> Crear mi cuenta</button>
              <button className="lp-btn lp-btn-outline" onClick={() => scrollTo('funciones')}>Conocer la plataforma</button>
            </motion.div>
            <motion.div className="lp-mini" variants={reveal}>
              <div><span className="mi"><FiShield /></span> Información segura y confiable</div>
              <div><span className="mi"><FiBarChart2 /></span> Potencia tu desarrollo</div>
              <div><span className="mi"><FiUsers /></span> Conecta con oportunidades</div>
            </motion.div>
          </motion.div>

          <motion.img
            src="/img_landing.png"
            alt="Afinia — perfil estudiantil dinámico"
            className="lp-hero-img"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          />
        </div>
      </header>

      {/* Problema */}
      <section className="lp-sec">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={reveal}>
          <div className="lp-kick">El propósito</div>
          <h2 className="lp-h2">¿Qué problema resuelve?</h2>
          <p className="lp-lead">La información académica y extracurricular suele estar dispersa en múltiples plataformas y formatos, dificultando su gestión y aprovechamiento.</p>
        </motion.div>
        <motion.div className="lp-grid3" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
          {problems.map((p) => (
            <motion.div className="lp-card" key={p.t} variants={reveal}>
              <div className="ico">{p.icon}</div>
              <h3>{p.t}</h3><p>{p.d}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Funciones */}
      <section className="lp-band-soft" id="funciones">
        <div className="in">
          <div className="lp-center"><div className="lp-kick">Funciones principales</div><h2 className="lp-h2">Todo lo que necesitas para mostrar tu valor</h2><p className="lp-lead">Seis módulos integrados que alimentan, en tiempo real, tu perfil dinámico.</p></div>
          <motion.div className="lp-feats" initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
            {features.map((f) => (
              <motion.div className="lp-card" key={f.t} variants={reveal} whileHover={{ scale: 1.02 }}>
                <div className="ico">{f.icon}</div>
                <h3>{f.t}</h3><p>{f.d}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="lp-band-dark" id="como">
        <div className="in">
          <div className="lp-center"><div className="lp-kick">Cómo funciona</div><h2 className="lp-h2">Tu camino en 5 pasos</h2></div>
          <div className="lp-steps">
            {steps.map((s, i) => (
              <motion.div
                className="lp-step"
                key={s.t}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -10 }}
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
        <div className="in">
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
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-sec" id="preguntas">
        <div className="lp-center"><div className="lp-kick">Preguntas frecuentes</div><h2 className="lp-h2">Resolvemos tus dudas</h2></div>
        <div className="lp-faq">
          {faqs.map((f, i) => (
            <div className={`lp-q ${open === i ? 'open' : ''}`} key={f.q}>
              <button onClick={() => setOpen(open === i ? null : i)}>{f.q} <FiChevronDown /></button>
              <motion.div className="a" initial={false} animate={{ height: open === i ? 'auto' : 0, paddingBottom: open === i ? '1rem' : 0 }} transition={{ duration: 0.25 }}>
                {f.a}
              </motion.div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="lp-band">
        <div className="in">
          <div><h2>Potencia tu perfil. Conecta con oportunidades.</h2><p>Empieza hoy a construir tu perfil académico y profesional.</p></div>
          <div className="lp-cta">
            <button className="lp-btn lp-btn-light" onClick={goRegister}><FiUser /> Crear mi cuenta</button>
            <button className="lp-btn lp-btn-outline" onClick={goLogin} style={{ background: 'transparent', borderColor: '#fff', color: '#fff' }}><FiLogIn /> Iniciar sesión</button>
          </div>
        </div>
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
            <a onClick={() => scrollTo('inicio')}>Inicio</a>
            <a onClick={() => scrollTo('funciones')}>Funciones</a>
            <a onClick={() => scrollTo('como')}>Cómo funciona</a>
            <a onClick={() => scrollTo('preguntas')}>Preguntas frecuentes</a>
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
        <div className="bottom">© Afinia · Perfil estudiantil dinámico — Implementación del 30% inicial</div>
      </footer>
    </div>
  );
}
