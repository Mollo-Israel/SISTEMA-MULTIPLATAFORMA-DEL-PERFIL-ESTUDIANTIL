/**
 * Elegibilidad por semestre de una necesidad de equipo (V3 §55, §56).
 *
 * Sin semestres objetivo, cualquiera puede verla. Con semestres, solo quien
 * cursa uno de ellos; un perfil sin semestre registrado no entra, porque no
 * hay forma de saber si cumple.
 */
export function semestreElegible(targetSemesters: number[] | null | undefined, semester: number | null | undefined): boolean {
  if (!targetSemesters || targetSemesters.length === 0) return true;
  if (semester === null || semester === undefined) return false;
  return targetSemesters.map(Number).includes(Number(semester));
}
