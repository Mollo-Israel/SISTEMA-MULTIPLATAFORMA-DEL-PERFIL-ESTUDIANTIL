import { DataSource } from 'typeorm';
import { AcademicArea } from '../../entities/academic-area.entity';
import { slugCode } from '../../common/validation';

const AREAS: { name: string; description: string; tags: string[] }[] = [
  {
    name: 'Desarrollo Web',
    description: 'Construcción de aplicaciones y servicios para la web.',
    // V3.2 §10.3: vocabulario del área, no copias de habilidades.
    tags: ['frontend', 'backend', 'aplicaciones web', 'servicios web', 'interfaces web'],
  },
  {
    name: 'Desarrollo Móvil',
    description: 'Aplicaciones para dispositivos móviles.',
    tags: ['aplicaciones móviles', 'mobile', 'multiplataforma', 'android'],
  },
  {
    name: 'Inteligencia Artificial',
    description: 'Aprendizaje automático y sistemas inteligentes.',
    tags: ['aprendizaje automático', 'modelos predictivos', 'visión por computadora', 'procesamiento de lenguaje natural', 'sistemas inteligentes'],
  },
  {
    name: 'Bases de Datos',
    description: 'Modelado, gestión y optimización de datos.',
    tags: ['persistencia', 'modelado de datos', 'almacenamiento', 'relacional', 'no relacional', 'consultas'],
  },
  {
    name: 'Redes',
    description: 'Infraestructura, comunicaciones y conectividad.',
    tags: ['networking', 'conectividad', 'telecomunicaciones', 'protocolos', 'enrutamiento', 'infraestructura de red'],
  },
  {
    name: 'Ciberseguridad',
    description: 'Protección de sistemas, datos y comunicaciones.',
    tags: ['seguridad informática', 'vulnerabilidades', 'protección de datos', 'análisis de riesgos', 'seguridad ofensiva', 'seguridad defensiva'],
  },
  {
    name: 'Ingeniería de Software',
    description: 'Procesos, arquitectura y calidad del software.',
    tags: ['arquitectura de software', 'calidad de software', 'procesos de desarrollo', 'requisitos', 'mantenimiento'],
  },
  {
    name: 'Gestión de Proyectos',
    description: 'Planificación y liderazgo de proyectos tecnológicos.',
    tags: ['planificación', 'metodologías ágiles', 'seguimiento', 'coordinación de equipos', 'gestión de riesgos'],
  },
  {
    name: 'Computación en la nube',
    description: 'Servicios en la nube, contenedores, despliegue y operación de sistemas.',
    tags: ['nube', 'cloud', 'contenedores', 'despliegue', 'escalabilidad', 'servicios administrados', 'devops'],
  },
];

export async function seedAcademicAreas(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(AcademicArea);
  for (const data of AREAS) {
    const existing = await repo.findOne({ where: { name: data.name } });
    if (!existing) {
      // El código se deriva del nombre, igual que al crear desde la API.
      await repo.save(repo.create({ ...data, code: slugCode(data.name) }));
    }
  }
}
