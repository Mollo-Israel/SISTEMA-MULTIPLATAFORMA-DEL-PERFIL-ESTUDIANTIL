import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { profileService } from '../services';
import { useDelayedFlag } from './ui';

/**
 * Hasta terminar la bienvenida, el estudiante solo ve la bienvenida.
 *
 * Casi todo el sistema depende de tener el perfil: entrar a «Recomendaciones»
 * o a «Mis afinidades» sin haber dicho nada devolvía pantallas vacías, y un
 * estudiante nuevo no sabía por dónde empezar. Esto no es una medida de
 * seguridad —la API protege cada dato por su cuenta—, es el orden del camino.
 *
 * Si la consulta falla, se deja pasar: un error de red no debe dejar a nadie
 * encerrado fuera del sistema.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<'cargando' | 'pendiente' | 'listo'>('cargando');
  const esperaVisible = useDelayedFlag(estado === 'cargando', 250);

  useEffect(() => {
    let vigente = true;
    profileService
      .onboarding()
      .then((s) => vigente && setEstado(s.completed ? 'listo' : 'pendiente'))
      .catch(() => vigente && setEstado('listo'));
    return () => {
      vigente = false;
    };
  }, []);

  if (estado === 'pendiente') return <Navigate to="/student/bienvenida" replace />;
  if (estado === 'cargando') {
    return esperaVisible ? <div className="gate-wait"><span className="qz-spinner" /></div> : null;
  }
  return <>{children}</>;
}
