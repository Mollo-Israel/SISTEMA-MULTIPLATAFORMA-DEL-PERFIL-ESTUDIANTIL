import { DataSource } from 'typeorm';
import { AcademicArea } from '../../entities/academic-area.entity';

const AREAS: { name: string; description: string; tags: string[] }[] = [
  {
    name: 'Desarrollo Web',
    description: 'Construcción de aplicaciones y servicios para la web.',
    tags: ['frontend', 'backend', 'react', 'node', 'api', 'html', 'css'],
  },
  {
    name: 'Desarrollo Móvil',
    description: 'Aplicaciones para dispositivos móviles.',
    tags: ['android', 'ios', 'react-native', 'flutter', 'kotlin'],
  },
  {
    name: 'Inteligencia Artificial',
    description: 'Aprendizaje automático y sistemas inteligentes.',
    tags: ['machine-learning', 'python', 'redes-neuronales', 'datos'],
  },
  {
    name: 'Bases de Datos',
    description: 'Modelado, gestión y optimización de datos.',
    tags: ['sql', 'postgresql', 'mongodb', 'modelado'],
  },
  {
    name: 'Redes',
    description: 'Infraestructura, comunicaciones y conectividad.',
    tags: ['tcp-ip', 'routing', 'linux', 'infraestructura'],
  },
  {
    name: 'Ciberseguridad',
    description: 'Protección de sistemas, datos y comunicaciones.',
    tags: ['pentesting', 'criptografia', 'vulnerabilidades', 'seguridad'],
  },
  {
    name: 'Ingeniería de Software',
    description: 'Procesos, arquitectura y calidad del software.',
    tags: ['uml', 'patrones', 'testing', 'git', 'arquitectura'],
  },
  {
    name: 'Gestión de Proyectos',
    description: 'Planificación y liderazgo de proyectos tecnológicos.',
    tags: ['scrum', 'kanban', 'liderazgo', 'planificacion'],
  },
];

export async function seedAcademicAreas(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(AcademicArea);
  for (const data of AREAS) {
    const existing = await repo.findOne({ where: { name: data.name } });
    if (!existing) {
      await repo.save(repo.create(data));
    }
  }
}
