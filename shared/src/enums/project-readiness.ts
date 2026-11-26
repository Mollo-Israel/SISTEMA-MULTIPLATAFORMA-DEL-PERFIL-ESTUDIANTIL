/**
 * V7.1 §8.1 (PROY-01) · Requisitos para activar un proyecto, compartidos.
 *
 * La API decide (`project-readiness.rules.ts`) y devuelve códigos. La web y
 * el móvil muestran estas mismas filas, en este orden, y marcan en rojo la que
 * tenga algún código faltante. Así no puede quedar «todo en verde» con el
 * botón deshabilitado: cada código que la API pueda devolver pertenece a una
 * fila.
 */
export const PROJECT_READINESS_ROWS: readonly { row: string; label: string; codes: readonly string[] }[] = [
  { row: 'title', label: 'Título', codes: ['title'] },
  { row: 'area', label: 'Al menos un área', codes: ['area'] },
  { row: 'skill', label: 'Al menos una tecnología del catálogo', codes: ['skill'] },
  { row: 'skill_per_area', label: 'Cada área con al menos una tecnología usada en ella', codes: ['skill_per_area'] },
  { row: 'repository', label: 'Repositorio público y válido', codes: ['repository', 'repository_invalid', 'repository_not_public'] },
  { row: 'members_pending', label: 'Invitaciones respondidas', codes: ['members_pending'] },
  { row: 'members_unconfirmed', label: 'Integrantes con su contribución confirmada', codes: ['members_unconfirmed'] },
  { row: 'own_contribution', label: 'Tu contribución confirmada', codes: ['own_contribution'] },
  { row: 'evidence', label: 'Evidencia del funcionamiento o demo accesible', codes: ['evidence'] },
];

/** La fila a la que pertenece un código; `null` si es uno nuevo que la interfaz aún no conoce. */
export function filaDeRequisito(code: string): string | null {
  return PROJECT_READINESS_ROWS.find((r) => r.codes.includes(code))?.row ?? null;
}
