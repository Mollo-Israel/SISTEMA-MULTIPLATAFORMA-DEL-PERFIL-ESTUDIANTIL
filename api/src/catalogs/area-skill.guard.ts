import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';

/**
 * Coherencia área → habilidades (V3 §4, §9.5, §67).
 *
 * Cuando un formulario declara áreas y habilidades a la vez, cada habilidad
 * tiene que pertenecer a una de esas áreas: la UI ya solo ofrece las de las
 * áreas elegidas, y el servidor lo exige igual, porque ocultar una opción en
 * pantalla no es una validación. Sin áreas declaradas no se restringe nada.
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
  const ajena = filas.find((s) => !s.academicAreaId || !areas.includes(s.academicAreaId));
  if (ajena) {
    const mensaje = `«${ajena.name}» pertenece a otra área. Elige su área o quítala.`;
    throw new BadRequestException({ message: mensaje, fields: { [campo]: [mensaje] } });
  }
}
