import { DataSource } from 'typeorm';
import { AcademicArea } from '../../entities/academic-area.entity';
import { Skill } from '../../entities/skill.entity';

const SKILLS_BY_AREA: Record<string, string[]> = {
  'Desarrollo Web': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'HTML y CSS'],
  'Desarrollo Móvil': ['React Native', 'Flutter', 'Kotlin'],
  'Inteligencia Artificial': ['Python', 'Machine Learning', 'Redes Neuronales'],
  'Bases de Datos': ['SQL', 'PostgreSQL', 'MongoDB'],
  Redes: ['TCP/IP', 'Routing', 'Administración Linux'],
  Ciberseguridad: ['Pentesting', 'Criptografía', 'Análisis de Vulnerabilidades'],
  'Ingeniería de Software': ['UML', 'Patrones de Diseño', 'Testing', 'Git'],
  'Gestión de Proyectos': ['Scrum', 'Kanban', 'Liderazgo'],
};

export async function seedSkills(dataSource: DataSource): Promise<void> {
  const areaRepo = dataSource.getRepository(AcademicArea);
  const skillRepo = dataSource.getRepository(Skill);

  for (const [areaName, skills] of Object.entries(SKILLS_BY_AREA)) {
    const area = await areaRepo.findOne({ where: { name: areaName } });
    for (const skillName of skills) {
      const existing = await skillRepo.findOne({ where: { name: skillName } });
      if (!existing) {
        await skillRepo.save(
          skillRepo.create({ name: skillName, academicAreaId: area ? area.id : null }),
        );
      }
    }
  }
}
