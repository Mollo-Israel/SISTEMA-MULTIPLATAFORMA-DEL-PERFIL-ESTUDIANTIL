import { DataSource } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { Role } from '../../entities/role.entity';

const ROLES: { name: RolNombre; description: string }[] = [
  { name: RolNombre.STUDENT, description: 'Construye su perfil estudiantil dinámico.' },
  { name: RolNombre.TEACHER, description: 'Publica actividades y confirma participación.' },
  { name: RolNombre.CAREER_DIRECTOR, description: 'Consulta reportes generales y mapa de afinidad.' },
  { name: RolNombre.SCIENTIFIC_SOCIETY, description: 'Publica actividades extracurriculares.' },
  { name: RolNombre.ADMIN, description: 'Gestiona usuarios, roles y catálogos.' },
];

export async function seedRoles(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Role);
  for (const data of ROLES) {
    const existing = await repo.findOne({ where: { name: data.name } });
    if (!existing) {
      await repo.save(repo.create(data));
    }
  }
}
