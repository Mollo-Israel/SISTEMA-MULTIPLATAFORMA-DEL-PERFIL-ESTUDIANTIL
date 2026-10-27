/**
 * V5-04 / V5-05 (A01–A03): primer apellido obligatorio, segundo opcional y
 * apellidos heredados que no se parten por suposición.
 */
import { componerApellidos, resolverApellidos, separarLegado } from '../../../src/users/surnames';
import { columnasDeApellido } from '../../../src/imports/csv.parser';

describe('V5-04 · apellidos', () => {
  it('A01: primer apellido y segundo vacío → éxito, apellido completo = el primero', () => {
    expect(resolverApellidos({ firstSurname: 'Quispe', secondSurname: '' }))
      .toEqual({ firstSurname: 'Quispe', secondSurname: null, lastName: 'Quispe' });
  });
  it('los dos apellidos componen el apellido completo', () => {
    expect(componerApellidos('Pérez', 'García')).toBe('Pérez García');
  });
  it('A02: «Pérez García» heredado se conserva y NO se asigna como dos apellidos', () => {
    expect(separarLegado('Pérez García')).toEqual({ firstSurname: null, secondSurname: null, lastName: 'Pérez García' });
  });
  it('A02: un apellido compuesto como «De la Cruz» tampoco se parte', () => {
    expect(separarLegado('De la Cruz').firstSurname).toBeNull();
  });
  it('un apellido heredado de una sola palabra se separa sin ambigüedad', () => {
    expect(separarLegado('Mamani')).toEqual({ firstSurname: 'Mamani', secondSurname: null, lastName: 'Mamani' });
  });
  it('sin ningún apellido no hay nada que guardar', () => {
    expect(resolverApellidos({})).toBeNull();
  });
});

describe('V5-05 · plantilla del padrón (A03)', () => {
  const csv = (headers: string[], values: Record<string, string>) => ({
    headers: [...headers],
    rows: [{ lineNumber: 2, values: { ...values }, columns: headers.length }],
  });

  it('la plantilla nueva compone last_name y conserva los dos apellidos', () => {
    const p = csv(['first_name', 'first_surname', 'second_surname'], { first_name: 'Ana', first_surname: 'Rojas', second_surname: 'Vargas' });
    columnasDeApellido(p);
    expect(p.headers).toContain('last_name');
    expect(p.rows[0].values.last_name).toBe('Rojas Vargas');
    expect(p.rows[0].values.first_surname).toBe('Rojas');
  });
  it('la plantilla anterior no se toca (sin desplazar columnas)', () => {
    const p = csv(['first_name', 'last_name'], { first_name: 'Ana', last_name: 'Rojas Vargas' });
    columnasDeApellido(p);
    expect(p.headers).toEqual(['first_name', 'last_name']);
    expect(p.rows[0].values.last_name).toBe('Rojas Vargas');
  });
});
