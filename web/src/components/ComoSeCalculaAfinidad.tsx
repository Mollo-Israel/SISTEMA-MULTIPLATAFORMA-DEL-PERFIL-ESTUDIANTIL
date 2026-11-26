import { Card } from './ui';

type Area = { area: string | null; score: number; level: string };

const NIVEL: Record<string, string> = { low: 'baja', medium: 'media', high: 'alta', none: 'sin afinidad' };

/**
 * V7.1 §9 (PERF-05) · Cómo se calcula la afinidad, en palabras.
 *
 * Usa los números reales del motor vigente (v7: los de V4 con la elegibilidad
 * de D04 y D01). Las tablas técnicas quedan aparte, para quien las necesite.
 * No muestra códigos ni prioridades numéricas. Los ejemplos del recuadro se
 * comprueban con el motor real en `e2e-v7.mjs batch8`.
 */
export default function ComoSeCalculaAfinidad({ areas }: Readonly<{ areas: Area[] }>) {
  const propias = [...areas].sort((a, b) => b.score - a.score).slice(0, 3);
  return (
    <Card title="Qué es tu afinidad y cómo se calcula" >
      <div className="como-se-calcula" data-testid="como-se-calcula">
        <p style={{ marginTop: 0 }}>
          La afinidad refleja <strong>cuánto de tu trayectoria registrada se relaciona con un área</strong>. Las experiencias
          con respaldo y la repetición, con un límite, contribuyen. <strong>No mide cuánto sabes ni califica tu rendimiento.</strong>
        </p>
        <h4>Qué la hace subir</h4>
        <ul>
          <li>
            <strong>Actividades con tu asistencia confirmada</strong> en esa área: la primera suma 10, la segunda 7, la tercera 5 y
            desde la cuarta 3. Las actividades de un área aportan como mucho 25.
          </li>
          <li>
            <strong>Proyectos con respaldo</strong> (repositorio que lo corrobora o revisión docente): hasta 50 entre todos.
          </li>
          <li>
            <strong>Credenciales externas aprobadas por Dirección con una prueba externa</strong>: hasta 25.
          </li>
          <li>El total de un área llega como mucho a 100.</li>
        </ul>
        <h4>Qué no la cambia</h4>
        <ul>
          <li>Lo que declaras (áreas de interés, lo que quieres mejorar, tecnologías de interés): orienta tus recomendaciones.</li>
          <li>Guardar, marcar como favorito, visitar o inscribirte sin que se confirme tu asistencia.</li>
          <li>Las actividades «Sin resultado» y las credenciales que todavía no aprobó Dirección.</li>
          <li>El tiempo: no baja por no usar la aplicación.</li>
        </ul>
        <h4>Cuándo puede bajar</h4>
        <p>
          Si se corrige una participación, se rechaza una evidencia o cambia la clasificación de una actividad. El cambio queda
          registrado y se vuelve a calcular con las mismas reglas.
        </p>
        <h4>Si llega al máximo</h4>
        <p>
          Significa que el índice alcanzó su tope según estas reglas: más actividades del mismo tipo ya no lo suben. No significa
          dominio profesional.
        </p>
        {propias.length > 0 && (
          <>
            <h4>En tus áreas</h4>
            <ul data-testid="ejemplos-propios">
              {propias.map((a) => (
                <li key={a.area ?? '—'}>
                  {a.area ?? 'Área'}: {Math.round(a.score)} de 100 (afinidad {NIVEL[a.level] ?? a.level}).
                  {a.score >= 100 ? ' Llegó al tope del índice.' : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
