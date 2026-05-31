// Datos de demo realistas (nombres neutros) para defender el 30% inicial.
// Arranca un contexto Nest y reutiliza el motor de afinidad real (sin duplicar lógica).
// Uso: npm run seed:demo  (workspace api)  —  requiere BD arriba y migraciones aplicadas.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  ActivityCategory,
  ActivityModality,
  ActivityStatus,
  ActivityType,
  ConstancyStatus,
  EvidenceType,
  ProjectStatus,
  RegistrationStatus,
  RolNombre,
  UserStatus,
} from '@perfil/shared';
import { AppModule } from '../../app.module';
import { AffinityEngineService } from '../../affinity-recalc/affinity.engine';
import { ProfilesService } from '../../profiles/profiles.service';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';
import { StudentProfile } from '../../entities/student-profile.entity';
import { AcademicArea } from '../../entities/academic-area.entity';
import { Skill } from '../../entities/skill.entity';
import { StudentInterest } from '../../entities/student-interest.entity';
import { StudentSkill } from '../../entities/student-skill.entity';
import { Activity } from '../../entities/activity.entity';
import { ActivityRegistration } from '../../entities/activity-registration.entity';
import { Project } from '../../entities/project.entity';
import { ProjectEvidence } from '../../entities/project-evidence.entity';
import { ExternalCertificate } from '../../entities/external-certificate.entity';
import { InternalConstancy } from '../../entities/internal-constancy.entity';
import { seedRoles } from './roles.seed';
import { seedAcademicAreas } from './academic-areas.seed';

const PWD = 'Demo123*';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const engine = app.get(AffinityEngineService);
  const profiles = app.get(ProfilesService);

  // Base: roles y áreas académicas (idempotente)
  await seedRoles(ds);
  await seedAcademicAreas(ds);

  const roleRepo = ds.getRepository(Role);
  const userRepo = ds.getRepository(User);
  const profileRepo = ds.getRepository(StudentProfile);
  const areaRepo = ds.getRepository(AcademicArea);
  const skillRepo = ds.getRepository(Skill);
  const interestRepo = ds.getRepository(StudentInterest);
  const studentSkillRepo = ds.getRepository(StudentSkill);
  const activityRepo = ds.getRepository(Activity);
  const regRepo = ds.getRepository(ActivityRegistration);
  const projectRepo = ds.getRepository(Project);
  const evidenceRepo = ds.getRepository(ProjectEvidence);
  const certRepo = ds.getRepository(ExternalCertificate);
  const constancyRepo = ds.getRepository(InternalConstancy);

  const areaByName = async (name: string) => areaRepo.findOneOrFail({ where: { name } });
  const areas = {
    web: await areaByName('Desarrollo Web'),
    movil: await areaByName('Desarrollo Móvil'),
    ia: await areaByName('Inteligencia Artificial'),
    bd: await areaByName('Bases de Datos'),
    redes: await areaByName('Redes'),
    ciber: await areaByName('Ciberseguridad'),
    soft: await areaByName('Ingeniería de Software'),
    gestion: await areaByName('Gestión de Proyectos'),
  };

  // Habilidades demo (upsert, mapeadas a su área)
  const skillDefs: { name: string; area: AcademicArea }[] = [
    { name: 'React', area: areas.web },
    { name: 'NestJS', area: areas.web },
    { name: 'PostgreSQL', area: areas.bd },
    { name: 'Python', area: areas.ia },
    { name: 'UI/UX', area: areas.web },
    { name: 'Testing', area: areas.soft },
    { name: 'Git', area: areas.soft },
    { name: 'Comunicación', area: areas.gestion },
    { name: 'Trabajo en equipo', area: areas.gestion },
  ];
  const skills: Record<string, Skill> = {};
  for (const def of skillDefs) {
    let skill = await skillRepo.findOne({ where: { name: def.name } });
    if (!skill) skill = skillRepo.create({ name: def.name });
    skill.academicAreaId = def.area.id;
    skills[def.name] = await skillRepo.save(skill);
  }

  // Usuarios demo por rol (nombres neutros)
  const roles: Record<string, Role> = {};
  for (const r of await roleRepo.find()) roles[r.name] = r;

  const upsertUser = async (
    firstName: string,
    lastName: string,
    email: string,
    role: RolNombre,
  ): Promise<User> => {
    let user = await userRepo.findOne({ where: { email } });
    const passwordHash = await bcrypt.hash(PWD, 10);
    if (!user) {
      user = userRepo.create({ firstName, lastName, email, passwordHash, roleId: roles[role].id, status: UserStatus.ACTIVE });
    } else {
      user.firstName = firstName;
      user.lastName = lastName;
      user.roleId = roles[role].id;
    }
    return userRepo.save(user);
  };

  const docente = await upsertUser('Docente', '1', 'docente1@demo.univalle.edu', RolNombre.TEACHER);
  const director = await upsertUser('Director', 'Carrera', 'director@demo.univalle.edu', RolNombre.CAREER_DIRECTOR);
  const sociedad = await upsertUser('Sociedad', 'Científica', 'sociedad@demo.univalle.edu', RolNombre.SCIENTIFIC_SOCIETY);
  const est1User = await upsertUser('Estudiante', '1', 'estudiante1@demo.univalle.edu', RolNombre.STUDENT);
  const est2User = await upsertUser('Estudiante', '2', 'estudiante2@demo.univalle.edu', RolNombre.STUDENT);

  // Perfiles
  const upsertProfile = async (user: User, semester: number, bio: string, improvement: AcademicArea[]) => {
    let p = await profileRepo.findOne({ where: { userId: user.id } });
    if (!p) p = profileRepo.create({ userId: user.id });
    p.semester = semester;
    p.bio = bio;
    p.improvementAreaIds = improvement.map((a) => a.id);
    return profileRepo.save(p);
  };
  const p1 = await upsertProfile(est1User, 5, 'Estudiante con foco en desarrollo web full-stack.', [areas.web]);
  const p2 = await upsertProfile(est2User, 7, 'Estudiante orientado a datos e inteligencia artificial.', [areas.ia]);

  // Intereses (reemplazo)
  const setInterests = async (profile: StudentProfile, items: { area: AcademicArea; priority: number }[]) => {
    await interestRepo.delete({ studentProfileId: profile.id });
    await interestRepo.save(items.map((i) => interestRepo.create({ studentProfileId: profile.id, academicAreaId: i.area.id, priority: i.priority })));
  };
  await setInterests(p1, [{ area: areas.web, priority: 5 }, { area: areas.ia, priority: 2 }]);
  await setInterests(p2, [{ area: areas.ia, priority: 5 }, { area: areas.bd, priority: 3 }]);

  // Habilidades declaradas (reemplazo)
  const setSkills = async (profile: StudentProfile, items: { skill: Skill; level: number }[]) => {
    await studentSkillRepo.delete({ studentProfileId: profile.id });
    await studentSkillRepo.save(items.map((i) => studentSkillRepo.create({ studentProfileId: profile.id, skillId: i.skill.id, level: i.level })));
  };
  await setSkills(p1, [
    { skill: skills['React'], level: 5 },
    { skill: skills['NestJS'], level: 4 },
    { skill: skills['UI/UX'], level: 4 },
    { skill: skills['Git'], level: 3 },
  ]);
  await setSkills(p2, [
    { skill: skills['Python'], level: 4 },
    { skill: skills['PostgreSQL'], level: 3 },
    { skill: skills['Comunicación'], level: 3 },
  ]);

  // Actividades (find-or-create por título)
  const upsertActivity = async (
    title: string,
    type: ActivityType,
    category: ActivityCategory,
    area: AcademicArea | null,
    creator: User,
  ): Promise<Activity> => {
    let a = await activityRepo.findOne({ where: { title } });
    if (!a) a = activityRepo.create({ title });
    a.description = `${title} (demo).`;
    a.type = type;
    a.category = category;
    a.modality = ActivityModality.PRESENCIAL;
    a.academicAreaId = area ? area.id : null;
    a.creatorId = creator.id;
    a.capacity = 40;
    a.status = ActivityStatus.OPEN;
    return activityRepo.save(a);
  };
  const actWeb = await upsertActivity('Taller de desarrollo web', ActivityType.ACADEMICA, ActivityCategory.TALLER_ACADEMICO, areas.web, docente);
  const actIa = await upsertActivity('Clase espejo de inteligencia artificial', ActivityType.ACADEMICA, ActivityCategory.CLASE_ESPEJO, areas.ia, docente);
  const actBd = await upsertActivity('Reto de bases de datos', ActivityType.ACADEMICA, ActivityCategory.RETO, areas.bd, docente);
  const actSoc = await upsertActivity('Actividad de sociedad científica', ActivityType.EXTRACURRICULAR, ActivityCategory.ACTIVIDAD_SOCIEDAD_CIENTIFICA, areas.soft, sociedad);

  // Participaciones (upsert por actividad+perfil)
  const upsertReg = async (activity: Activity, profile: StudentProfile, status: RegistrationStatus, confirmedBy?: User) => {
    let r = await regRepo.findOne({ where: { activityId: activity.id, studentProfileId: profile.id } });
    if (!r) r = regRepo.create({ activityId: activity.id, studentProfileId: profile.id });
    r.status = status;
    r.confirmedById = confirmedBy ? confirmedBy.id : null;
    return regRepo.save(r);
  };
  const regWeb1 = await upsertReg(actWeb, p1, RegistrationStatus.CONFIRMED, docente);
  await upsertReg(actSoc, p1, RegistrationStatus.INTERESTED);
  await upsertReg(actIa, p2, RegistrationStatus.CONFIRMED, docente);
  await upsertReg(actBd, p2, RegistrationStatus.CONFIRMED, docente);

  // Proyectos (find-or-create por título)
  const upsertProject = async (
    title: string,
    profile: StudentProfile,
    area: AcademicArea,
    technologies: string[],
    repo: string,
    demo: string,
  ): Promise<Project> => {
    let p = await projectRepo.findOne({ where: { title } });
    if (!p) p = projectRepo.create({ title });
    p.description = `${title} (demo).`;
    p.createdByProfileId = profile.id;
    p.academicAreaId = area.id;
    p.technologies = technologies;
    p.status = ProjectStatus.ACTIVE;
    p.repositoryUrl = repo;
    p.demoUrl = demo;
    p = await projectRepo.save(p);
    // Evidencias (solo si no tiene)
    const count = await evidenceRepo.count({ where: { projectId: p.id } });
    if (count === 0) {
      await evidenceRepo.save([
        evidenceRepo.create({ projectId: p.id, evidenceType: EvidenceType.LINK, description: 'Repositorio', externalUrl: repo }),
        evidenceRepo.create({ projectId: p.id, evidenceType: EvidenceType.LINK, description: 'Demo desplegada', externalUrl: demo }),
      ]);
    }
    return p;
  };
  await upsertProject('Sistema académico web', p1, areas.web, ['React', 'NestJS', 'PostgreSQL'], 'https://github.com/demo/sistema-academico-web', 'https://demo.example.com/sistema-academico');
  await upsertProject('App móvil de seguimiento', p1, areas.movil, ['React Native', 'Expo'], 'https://github.com/demo/app-movil-seguimiento', 'https://demo.example.com/app-movil');
  await upsertProject('Dashboard de reportes', p2, areas.bd, ['React', 'PostgreSQL'], 'https://github.com/demo/dashboard-reportes', 'https://demo.example.com/dashboard');

  // Certificados externos ficticios (find-or-create por perfil+nombre)
  const upsertCert = async (profile: StudentProfile, name: string, issuer: string, url: string, date: string) => {
    const existing = await certRepo.findOne({ where: { studentProfileId: profile.id, certificateName: name } });
    if (existing) return existing;
    return certRepo.save(certRepo.create({ studentProfileId: profile.id, certificateName: name, issuer, certificateUrl: url, issueDate: date }));
  };
  await upsertCert(p1, 'Certified React Developer', 'Plataforma Externa Demo', 'https://cert.example.com/react/demo1', '2026-01-20');
  await upsertCert(p2, 'Python for Data Science', 'Academia Online Demo', 'https://cert.example.com/python/demo2', '2026-02-10');

  // Constancia interna autorizada (find-or-create)
  const existingConstancy = await constancyRepo.findOne({ where: { studentProfileId: p1.id, activityId: actWeb.id } });
  if (!existingConstancy) {
    await constancyRepo.save(
      constancyRepo.create({
        studentProfileId: p1.id,
        activityId: actWeb.id,
        activityRegistrationId: regWeb1.id,
        description: 'Participación confirmada en el Taller de desarrollo web.',
        status: ConstancyStatus.AUTHORIZED,
        authorizedById: docente.id,
      }),
    );
  }

  // Completitud del perfil (regla real del servicio) y afinidades con el motor real
  await profiles.recomputeCompletion(p1.id);
  await profiles.recomputeCompletion(p2.id);
  await engine.recalculate(p1.id);
  await engine.recalculate(p2.id);

  const a1 = await engine.getForProfile(p1.id);
  const a2 = await engine.getForProfile(p2.id);

  console.log('\nDatos de demo creados (nombres neutros):');
  console.log('  Usuarios: Estudiante 1, Estudiante 2, Docente 1, Director, Sociedad Científica (+ Administrador del seed base)');
  console.log('  Contraseña demo: ' + PWD + '   ·   Admin: admin@univalle.edu / Admin123*');
  console.log('\n  Afinidad Estudiante 1:');
  a1.forEach((a) => console.log(`    - ${a.academicArea?.name}: ${a.score} (${a.level})`));
  console.log('  Afinidad Estudiante 2:');
  a2.forEach((a) => console.log(`    - ${a.academicArea?.name}: ${a.score} (${a.level})`));
  console.log('\nListo. Ejecuta la API y revisa web/móvil o Swagger en /api/docs.\n');

  await app.close();
}

run().catch((e) => {
  console.error('Error en seed de demo:', e);
  process.exit(1);
});
