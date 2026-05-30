import { AppDataSource } from '../data-source';
import { seedRoles } from './roles.seed';
import { seedAcademicAreas } from './academic-areas.seed';
import { seedSkills } from './skills.seed';

async function run(): Promise<void> {
  const dataSource = await AppDataSource.initialize();
  try {
    await seedRoles(dataSource);
    await seedAcademicAreas(dataSource);
    await seedSkills(dataSource);
    console.log('Seeds aplicados correctamente.');
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Error al aplicar seeds:', error);
  process.exit(1);
});
