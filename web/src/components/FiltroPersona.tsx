import { useEffect, useId, useState } from 'react';
import { Button } from './ui';

export interface PersonaFiltro {
  id: string;
  name: string;
}

/**
 * V7.1 §11: filtro por una persona (publicador en Biblioteca, responsable en
 * Proyectos de la carrera). Se escribe el nombre o los apellidos —con o sin
 * tildes, coma u orden— y se elige de las sugerencias que da el servidor. El
 * servidor solo sugiere personas con contenido visible, sin correos y desde
 * 2 letras; el filtro se aplica por identificador, nunca por el nombre.
 */
export function FiltroPersona({ label, valor, onChange, buscar, testId }: Readonly<{
  label: string;
  valor: PersonaFiltro | null;
  onChange: (p: PersonaFiltro | null) => void;
  buscar: (q: string) => Promise<PersonaFiltro[]>;
  testId: string;
}>) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const [candidatos, setCandidatos] = useState<PersonaFiltro[]>([]);
  const [buscado, setBuscado] = useState('');

  useEffect(() => {
    const t = texto.trim();
    if (t.length < 2) { setCandidatos([]); setBuscado(''); return; }
    let vigente = true;
    const espera = window.setTimeout(() => {
      buscar(t)
        .then((r) => { if (vigente) { setCandidatos(r); setBuscado(t); } })
        .catch(() => { if (vigente) { setCandidatos([]); setBuscado(t); } });
    }, 250);
    return () => { vigente = false; window.clearTimeout(espera); };
  }, [texto, buscar]);

  // «Limpiar» de la página quita la persona: el texto escrito también se va.
  useEffect(() => { if (!valor) setTexto(''); }, [valor]);

  if (valor) {
    return (
      <div className="field filtro-persona" data-testid={testId}>
        <span className="small muted">{label}</span>
        <div className="flex" style={{ gap: '0.4rem', alignItems: 'center' }}>
          <strong data-testid={`${testId}-elegido`}>{valor.name}</strong>
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Quitar</Button>
        </div>
      </div>
    );
  }
  const sinCoincidencias = !!buscado && buscado === texto.trim() && candidatos.length === 0;
  return (
    <div className="field filtro-persona" data-testid={testId}>
      <label htmlFor={id} className="small muted">{label}</label>
      <input
        id={id}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre o apellidos…"
        role="combobox"
        aria-expanded={candidatos.length > 0}
        aria-controls={`${id}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {candidatos.length > 0 && (
        <ul id={`${id}-lista`} className="plain-list filtro-persona-lista" role="listbox" aria-label={label}>
          {candidatos.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button type="button" className="link-button" onClick={() => { onChange(c); setCandidatos([]); }}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {sinCoincidencias && <span className="small muted" role="status">Nadie con ese nombre.</span>}
    </div>
  );
}
