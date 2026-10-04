import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAward, FiBarChart2, FiCalendar, FiCheckSquare, FiFolder, FiHome, FiSettings, FiShield,
  FiTarget, FiUpload, FiUser, FiUsers,
} from 'react-icons/fi';
import { useAuth } from '../auth/AuthContext';
import { TUTORIAL, type TutorialStep } from '../help/content';
import { Button, Modal } from './ui';

const ICONOS: Record<TutorialStep['icon'], JSX.Element> = {
  home: <FiHome size={26} />,
  user: <FiUser size={26} />,
  calendar: <FiCalendar size={26} />,
  folder: <FiFolder size={26} />,
  target: <FiTarget size={26} />,
  users: <FiUsers size={26} />,
  award: <FiAward size={26} />,
  shield: <FiShield size={26} />,
  check: <FiCheckSquare size={26} />,
  chart: <FiBarChart2 size={26} />,
  upload: <FiUpload size={26} />,
  settings: <FiSettings size={26} />,
};

/** Evento con el que el centro de ayuda o el menú vuelven a abrir el tutorial. */
export const OPEN_TUTORIAL_EVENT = 'afinia:tutorial';
export const openTutorial = () => window.dispatchEvent(new Event(OPEN_TUTORIAL_EVENT));

const clave = (userId: string) => `afinia.tutorial.v1:${userId}`;

function yaVisto(userId: string): boolean {
  try {
    return window.localStorage.getItem(clave(userId)) === '1';
  } catch {
    // Sin almacenamiento (navegación privada): no insistir en cada pantalla.
    return true;
  }
}

function marcarVisto(userId: string) {
  try {
    window.localStorage.setItem(clave(userId), '1');
  } catch {
    /* sin almacenamiento: el tutorial se puede reabrir desde Ayuda */
  }
}

/**
 * Tutorial de primer uso (V2 §65). Se muestra una vez por persona y
 * navegador, se puede omitir en cualquier paso y se reabre desde «Ayuda» o
 * desde el menú de usuario. Nunca bloquea el sistema.
 */
export default function Tutorial() {
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(0);
  const pasos = user ? TUTORIAL[user.role] ?? [] : [];

  useEffect(() => {
    if (!user || pasos.length === 0) return;
    if (!yaVisto(user.id)) setAbierto(true);
    const reabrir = () => {
      setPaso(0);
      setAbierto(true);
    };
    window.addEventListener(OPEN_TUTORIAL_EVENT, reabrir);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, reabrir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!abierto || !user || pasos.length === 0) return null;
  const actual = pasos[Math.min(paso, pasos.length - 1)];
  const cerrar = () => {
    marcarVisto(user.id);
    setAbierto(false);
  };
  const ultimo = paso >= pasos.length - 1;

  return (
    <Modal title="Cómo funciona Afinia" subtitle={`Paso ${paso + 1} de ${pasos.length}`} onClose={cerrar} width={480}>
      <div className="tutorial-step" aria-live="polite">
        <span className="tutorial-icon" aria-hidden="true">{ICONOS[actual.icon]}</span>
        <h4>{actual.title}</h4>
        <p>{actual.text}</p>
        {actual.to && (
          <Link to={actual.to} onClick={cerrar} className="link-button">
            Ir a {actual.title.toLowerCase()}
          </Link>
        )}
      </div>
      <div className="tutorial-dots" aria-hidden="true">
        {pasos.map((_, i) => <span key={i} className={i === paso ? 'on' : ''} />)}
      </div>
      <div className="flex between" style={{ marginTop: '1rem', gap: '0.5rem' }}>
        <Button variant="ghost" size="sm" onClick={cerrar}>Omitir</Button>
        <div className="flex" style={{ gap: '0.4rem' }}>
          {paso > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setPaso(paso - 1)}>Anterior</Button>
          )}
          {ultimo
            ? <Button size="sm" onClick={cerrar}>Terminar</Button>
            : <Button size="sm" onClick={() => setPaso(paso + 1)}>Siguiente</Button>}
        </div>
      </div>
    </Modal>
  );
}
