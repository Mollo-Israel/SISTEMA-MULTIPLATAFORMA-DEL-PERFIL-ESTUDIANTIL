import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { SkillAreaRelation } from '../entities/skill-area-relation.entity';

/**
 * Coherencia área → habilidades (V3 §4, §9.5, §67).
 *
 * Cuando un formulario declara áreas y habilidades a la vez, cada habilidad
 * tiene que pertenecer a una de esas áreas: la UI ya solo ofrece las de las
 * áreas elegidas, y el servidor lo exige igual, porque ocultar una opción en
 * pantalla no es una validación. Sin áreas declaradas no se restringe nada.
 *
 * V3.2 §11: vale el área principal de la habilidad o una de sus secundarias.
 */
export async function assertSkillsBelongToAreas(
  manager: EntityManager,
  skillIds: string[] | undefined,
  areaIds: string[] | undefined,
  campo = 'skillIds',
): Promise<void> {
  const habilidades = [...new Set(skillIds ?? [])];
  const areas = [...new Set(areaIds ?? [])];
  if (areas.length > 0) {
    const existentes = await manager.getRepository(AcademicArea).count({ where: { id: In(areas) } });
    if (existentes !== areas.length) throw new NotFoundException('Una o más áreas académicas no existen.');
  }
  if (habilidades.length === 0 || areas.length === 0) return;
  const filas = await manager.getRepository(Skill).find({
    where: { id: In(habilidades) },
    select: { id: true, name: true, academicAreaId: true },
  });
  if (filas.length !== habilidades.length) throw new NotFoundException('Una o más habilidades no existen en el catálogo.');
  const secundarias = await manager.getRepository(SkillAreaRelation).find({
    where: { skillId: In(habilidades), academicAreaId: In(areas) },
  });
  const porSecundaria = new Set(secundarias.map((r) => r.skillId));
  const ajena = filas.find(
    (s) => !porSecundaria.has(s.id) && (!s.academicAreaId || !areas.includes(s.academicAreaId)),
  );
  if (ajena) {
    const mensaje = `«${ajena.name}» pertenece a otra área. Elige su área o quítala.`;
    throw new BadRequestException({ message: mensaje, fields: { [campo]: [mensaje] } });
  }
}

export interface SkillContext {
  skillId: string;
  areaId: string | null;
}

/**
 * V3.2 §11.4: el área en que se usa cada habilidad de una experiencia.
 *
 * - Lo que el formulario indica explícitamente se valida: el área tiene que
 *   estar entre las elegidas y la habilidad tiene que pertenecer a ella
 *   (principal o secundaria).
 * - Lo que no se indica se deduce: su área principal si está elegida; si no,
 *   la primera secundaria elegida. Si no hay áreas, queda sin contexto.
 *
 * Llamar después de `assertSkillsBelongToAreas`.
 */
export async function resolveSkillContexts(
  manager: EntityManager,
  skillIds: string[],
  areaIds: string[],
  explicitos: { skillId: string; areaId: string }[] = [],
  campo = 'skillContexts',
): Promise<SkillContext[]> {
  const habilidades = [...new Set(skillIds)];
  if (habilidades.length === 0) return [];
  const areas = [...new Set(areaIds)];
  const filas = await manager.getRepository(Skill).find({
    where: { id: In(habilidades) },
    select: { id: true, name: true, academicAreaId: true },
  });
  const secundarias = areas.length
    ? await manager.getRepository(SkillAreaRelation).find({ where: { skillId: In(habilidades), academicAreaId: In(areas) } })
    : [];
  const pertenece = (skillId: string, areaId: string) =>
    filas.some((s) => s.id === skillId && s.academicAreaId === areaId)
    || secundarias.some((r) => r.skillId === skillId && r.academicAreaId === areaId);
  const pedido = new Map(explicitos.map((c) => [c.skillId, c.areaId]));

  return habilidades.map((skillId) => {
    const skill = filas.find((s) => s.id === skillId);
    const explicito = pedido.get(skillId);
    if (explicito) {
      if (!areas.includes(explicito) || !pertenece(skillId, explicito)) {
        const mensaje = `«${skill?.name ?? 'La habilidad'}» no pertenece al área indicada para ella. Elige una de sus áreas entre las seleccionadas.`;
        throw new BadRequestException({ message: mensaje, fields: { [campo]: [mensaje] } });
      }
      return { skillId, areaId: explicito };
    }
    if (skill?.academicAreaId && areas.includes(skill.academicAreaId)) return { skillId, areaId: skill.academicAreaId };
    const secundaria = areas.find((a) => secundarias.some((r) => r.skillId === skillId && r.academicAreaId === a));
    return { skillId, areaId: secundaria ?? null };
  });
}
