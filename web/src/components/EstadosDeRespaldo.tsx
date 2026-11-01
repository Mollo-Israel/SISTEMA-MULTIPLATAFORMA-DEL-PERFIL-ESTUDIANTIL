/**
 * V6 §10.2 (HIST-02): qué significa cada estado de respaldo, en un solo lugar
 * que usan la trayectoria, los proyectos y las credenciales. Es el mismo texto
 * que `BACKING_STATES_EXPLAINED` en `shared`. Ninguno es un certificado.
 */
const ESTADOS: { label: string; meaning: string }[] = [
  { label: 'Declarado', meaning: 'Lo registraste; no tenemos una señal comprobable suficiente.' },
  { label: 'Con respaldo', meaning: 'Hay una fuente consultable, un documento o una señal parcial (por ejemplo, el documento se leyó y coincide, o el repositorio muestra la tecnología), sin una verificación individual concluyente. No es tener un certificado.' },
  { label: 'Corroborado', meaning: 'Se contrastó una señal concreta con una fuente según las reglas: el emisor oficial identificó la credencial, o el repositorio y la demo respondieron.' },
  { label: 'Revisado', meaning: 'Una persona identificada (un docente) lo revisó; se indica qué revisó. No es una certificación profesional.' },
  { label: 'Inconcluso', meaning: 'No se pudo determinar más por falta o indisponibilidad de la prueba (por ejemplo, el emisor no respondió). No es una sospecha de fraude.' },
  { label: 'Observado', meaning: 'Algo no coincide; tiene un motivo y se puede corregir para volver a comprobarlo.' },
];

export default function EstadosDeRespaldo() {
  return (
    <details className="estados-respaldo" data-testid="estados-respaldo">
      <summary>¿Qué significa cada estado de respaldo?</summary>
      <dl>
        {ESTADOS.map((e) => (
          <div key={e.label}>
            <dt>{e.label}</dt>
            <dd>{e.meaning}</dd>
          </div>
        ))}
      </dl>
      <p className="muted small" style={{ margin: 0 }}>
        Un repositorio en verde es una señal de código, no una acreditación personal. Afinia no emite ni certifica credenciales.
      </p>
    </details>
  );
}
