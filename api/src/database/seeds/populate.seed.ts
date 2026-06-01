// Población de la base con cuentas institucionales (univalle.edu / est.univalle.edu)
// y un conjunto de datos amplio y variado. Arranca un contexto Nest y reutiliza
// el motor de afinidad real (sin duplicar lógica). Idempotente.
// Uso: npm run seed:populate  (workspace api) — requiere BD arriba y migraciones aplicadas.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  ActivityCategory, ActivityModality, ActivityStatus, ActivityType,
  ConstancyStatus, EvidenceType, ProjectStatus, RegistrationStatus, RolNombre, UserStatus,
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
import { seedSkills } from './skills.seed';
import { seedAdminUser } from './users.seed';

const PWD = 'Univalle2026*';
const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const STAFF: { first: string; last: string; role: RolNombre }[] = [
  { first: 'Carlos', last: 'Pérez', role: RolNombre.TEACHER },
  { first: 'María', last: 'Gutiérrez', role: RolNombre.TEACHER },
  { first: 'Jorge', last: 'Vargas', role: RolNombre.CAREER_DIRECTOR },
  { first: 'Lucía', last: 'Fernández', role: RolNombre.SCIENTIFIC_SOCIETY },
];

const STUDENT_NAMES: [string, string][] = [
  ['Ana', 'Quispe'], ['Luis', 'Mamani'], ['Daniela', 'Rojas'], ['Pedro', 'Choque'],
  ['Camila', 'Flores'], ['Diego', 'Mendoza'], ['Valeria', 'Ticona'], ['Sergio', 'Apaza'],
  ['Gabriela', 'Cruz'], ['Andrés', 'Villca'], ['Paola', 'Condori'], ['Marco', 'Salazar'],
  ['Fernanda', 'Aramayo'], ['Iván', 'Cabrera'], ['Rosa', 'Limachi'], ['Tomás', 'Suárez'],
];

const AREA_SKILLS: Record<string, string[]> = {
  'Desarrollo Web': ['React', 'NestJS', 'UI/UX'],
  'Desarrollo Móvil': ['React Native', 'Flutter', 'Kotlin'],
  'Inteligencia Artificial': ['Python', 'Machine Learning'],
  'Bases de Datos': ['PostgreSQL', 'SQL', 'MongoDB'],
  Redes: ['TCP/IP', 'Routing', 'Administración Linux'],
  Ciberseguridad: ['Pentesting', 'Criptografía'],
  'Ingeniería de Software': ['UML', 'Patrones de Diseño', 'Testing', 'Git'],
  'Gestión de Proyectos': ['Scrum', 'Kanban', 'Comunicación'],
};

const PROJECTS = [
  { title: 'Sistema académico web', techs: ['React', 'NestJS', 'PostgreSQL'] },
  { title: 'App móvil de seguimiento', techs: ['React Native', 'Expo'] },
  { title: 'Dashboard de reportes', techs: ['React', 'PostgreSQL'] },
  { title: 'API de gestión de proyectos', techs: ['NestJS', 'TypeScript'] },
  { title: 'Plataforma de tutorías', techs: ['React', 'Node.js'] },
  { title: 'Portal de evidencias académicas', techs: ['Next.js', 'PostgreSQL'] },
  { title: 'Visualizador de afinidades', techs: ['React', 'D3.js'] },
  { title: 'Asistente de estudio con IA', techs: ['Python', 'Machine Learning'] },
];

const CERTS = [
  { name: 'Certified JavaScript Developer', issuer: 'freeCodeCamp' },
  { name: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services' },
  { name: 'Python for Data Science', issuer: 'Coursera' },
  { name: 'Scrum Fundamentals Certified', issuer: 'Scrum.org' },
  { name: 'Cisco CCNA: Introduction to Networks', issuer: 'Cisco Networking Academy' },
  { name: 'Fundamentos de UX', issuer: 'Google' },
];

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const ds = app.get(DataSource);
  const engine = app.get(AffinityEngineService);
  const profilesService = app.get(ProfilesService);

  // Base (idempotente): roles, áreas, catálogo de habilidades y administrador único.
  await seedRoles(ds);
  await seedAcademicAreas(ds);
  await seedSkills(ds);
  await seedAdminUser(ds);

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

  const roles: Record<string, Role> = {};
  for (const r of await roleRepo.find()) roles[r.name] = r;
  const areaList = await areaRepo.find({ order: { name: 'ASC' } });
  const areaByName = (n: string) => areaList.find((a) => a.name === n)!;
  const passwordHash = await bcrypt.hash(PWD, 10);

  const upsertUser = async (first: string, last: string, email: string, role: RolNombre): Promise<User> => {
    let u = await userRepo.findOne({ where: { email } });
    if (!u) u = userRepo.create({ email });
    u.firstName = first;
    u.lastName = last;
    u.passwordHash = passwordHash;
    u.roleId = roles[role].id;
    u.status = UserStatus.ACTIVE;
    return userRepo.save(u);
  };

  // ---- Personal administrativo/docente (univalle.edu) ----
  const staffUsers: User[] = [];
  for (const s of STAFF) {
    const email = `${ascii(s.first)}.${ascii(s.last)}@univalle.edu`;
    staffUsers.push(await upsertUser(s.first, s.last, email, s.role));
  }
  const docentes = staffUsers.filter((u) => u.roleId === roles[RolNombre.TEACHER].id);
  const sociedad = staffUsers.find((u) => u.roleId === roles[RolNombre.SCIENTIFIC_SOCIETY].id)!;

  // ---- Estudiantes (est.univalle.edu) con perfil, intereses y habilidades ----
  const skillByName = new Map<string, Skill>();
  for (const sk of await skillRepo.find()) skillByName.set(sk.name, sk);

  const studentProfiles: StudentProfile[] = [];
  for (let i = 0; i < STUDENT_NAMES.length; i++) {
    const [first, last] = STUDENT_NAMES[i];
    const email = `${ascii(first)}.${ascii(last)}@est.univalle.edu`;
    const user = await upsertUser(first, last, email, RolNombre.STUDENT);

    const primary = areaList[i % areaList.length];
    const secondary = areaList[(i + 3) % areaList.length];

    let profile = await profileRepo.findOne({ where: { userId: user.id } });
    if (!profile) profile = profileRepo.create({ userId: user.id });
    profile.semester = (i % 8) + 1;
    profile.bio = `Estudiante de Ingeniería en Sistemas con interés en ${primary.name.toLowerCase()}.`;
    profile.improvementAreaIds = [secondary.id];
    profile = await profileRepo.save(profile);
    studentProfiles.push(profile);

    // Intereses
    await interestRepo.delete({ studentProfileId: profile.id });
    await interestRepo.save([
      interestRepo.create({ studentProfileId: profile.id, academicAreaId: primary.id, priority: 5 }),
      interestRepo.create({ studentProfileId: profile.id, academicAreaId: secondary.id, priority: 3 }),
    ]);

    // Habilidades (alineadas a su área principal)
    await studentSkillRepo.delete({ studentProfileId: profile.id });
    const names = (AREA_SKILLS[primary.name] ?? []).slice(0, 2);
    const extra = (AREA_SKILLS[secondary.name] ?? [])[0];
    if (extra) names.push(extra);
    const rows = names
      .map((n) => skillByName.get(n))
      .filter((s): s is Skill => !!s)
      .map((s, idx) => studentSkillRepo.create({ studentProfileId: profile!.id, skillId: s.id, level: 5 - idx }));
    if (rows.length) await studentSkillRepo.save(rows);
  }

  // ---- Actividades (académicas por docentes, extracurriculares por sociedad) ----
  const activityDefs: { title: string; type: ActivityType; cat: ActivityCategory; area: string; cap: number; creator: User }[] = [
    { title: 'Taller de Desarrollo Web', type: ActivityType.ACADEMICA, cat: ActivityCategory.TALLER_ACADEMICO, area: 'Desarrollo Web', cap: 20, creator: docentes[0] },
    { title: 'Seminario de Inteligencia Artificial', type: ActivityType.ACADEMICA, cat: ActivityCategory.SEMINARIO, area: 'Inteligencia Artificial', cap: 30, creator: docentes[0] },
    { title: 'Reto de Bases de Datos', type: ActivityType.ACADEMICA, cat: ActivityCategory.RETO, area: 'Bases de Datos', cap: 15, creator: docentes[1] },
    { title: 'Clase espejo de Ingeniería de Software', type: ActivityType.ACADEMICA, cat: ActivityCategory.CLASE_ESPEJO, area: 'Ingeniería de Software', cap: 25, creator: docentes[1] },
    { title: 'Charla de Ciberseguridad', type: ActivityType.ACADEMICA, cat: ActivityCategory.CHARLA, area: 'Ciberseguridad', cap: 40, creator: docentes[0] },
    { title: 'Tutoría de Redes', type: ActivityType.ACADEMICA, cat: ActivityCategory.TUTORIA, area: 'Redes', cap: 12, creator: docentes[1] },
    { title: 'Hackathon de Innovación', type: ActivityType.EXTRACURRICULAR, cat: ActivityCategory.HACKATHON, area: 'Inteligencia Artificial', cap: 50, creator: sociedad },
    { title: 'Club de Estudio de Desarrollo Móvil', type: ActivityType.EXTRACURRICULAR, cat: ActivityCategory.CLUB_ESTUDIO, area: 'Desarrollo Móvil', cap: 20, creator: sociedad },
    { title: 'Actividad de Responsabilidad Social', type: ActivityType.EXTRACURRICULAR, cat: ActivityCategory.RESPONSABILIDAD_SOCIAL, area: 'Gestión de Proyectos', cap: 30, creator: sociedad },
  ];
  const activities: Activity[] = [];
  for (const d of activityDefs) {
    let a = await activityRepo.findOne({ where: { title: d.title } });
    if (!a) a = activityRepo.create({ title: d.title });
    a.description = `${d.title} para estudiantes de Ingeniería en Sistemas.`;
    a.type = d.type;
    a.category = d.cat;
    a.modality = ActivityModality.PRESENCIAL;
    a.academicAreaId = areaByName(d.area).id;
    a.creatorId = d.creator.id;
    a.capacity = d.cap;
    a.status = ActivityStatus.OPEN;
    activities.push(await activityRepo.save(a));
  }

  // ---- Participaciones (mezcla de confirmado / pendiente / interés) ----
  const upsertReg = async (act: Activity, profile: StudentProfile, status: RegistrationStatus, confirmedBy?: string) => {
    let r = await regRepo.findOne({ where: { activityId: act.id, studentProfileId: profile.id } });
    if (!r) r = regRepo.create({ activityId: act.id, studentProfileId: profile.id });
    r.status = status;
    r.confirmedById = confirmedBy ?? null;
    return regRepo.save(r);
  };
  for (let i = 0; i < studentProfiles.length; i++) {
    const p = studentProfiles[i];
    const aConf = activities[i % activities.length];
    const aPend = activities[(i + 4) % activities.length];
    const aInt = activities[(i + 2) % activities.length];
    await upsertReg(aConf, p, RegistrationStatus.CONFIRMED, aConf.creatorId);
    if (aPend.id !== aConf.id) await upsertReg(aPend, p, RegistrationStatus.REGISTERED);
    if (aInt.id !== aConf.id && aInt.id !== aPend.id) await upsertReg(aInt, p, RegistrationStatus.INTERESTED);
  }

  // ---- Proyectos con evidencias (a 8 estudiantes) ----
  for (let i = 0; i < PROJECTS.length; i++) {
    const def = PROJECTS[i];
    const profile = studentProfiles[i * 2]; // estudiantes pares
    const area = areaList[(i * 2) % areaList.length];
    let pr = await projectRepo.findOne({ where: { title: def.title } });
    if (!pr) pr = projectRepo.create({ title: def.title });
    pr.description = `${def.title} desarrollado como proyecto académico.`;
    pr.createdByProfileId = profile.id;
    pr.academicAreaId = area.id;
    pr.technologies = def.techs;
    pr.status = ProjectStatus.ACTIVE;
    pr.repositoryUrl = `https://github.com/univalle-isi/${ascii(def.title).replace(/[^a-z0-9]+/g, '-')}`;
    pr.demoUrl = `https://isi.univalle.edu/proyectos/${ascii(def.title).replace(/[^a-z0-9]+/g, '-')}`;
    pr = await projectRepo.save(pr);
    if ((await evidenceRepo.count({ where: { projectId: pr.id } })) === 0) {
      await evidenceRepo.save([
        evidenceRepo.create({ projectId: pr.id, evidenceType: EvidenceType.LINK, description: 'Repositorio', externalUrl: pr.repositoryUrl }),
        evidenceRepo.create({ projectId: pr.id, evidenceType: EvidenceType.LINK, description: 'Demostración', externalUrl: pr.demoUrl }),
      ]);
    }
  }

  // ---- Certificados externos (a algunos estudiantes) ----
  for (let i = 0; i < CERTS.length; i++) {
    const c = CERTS[i];
    const profile = studentProfiles[i * 2 + 1]; // estudiantes impares
    if (!profile) continue;
    const exists = await certRepo.findOne({ where: { studentProfileId: profile.id, certificateName: c.name } });
    if (!exists) {
      await certRepo.save(certRepo.create({
        studentProfileId: profile.id, certificateName: c.name, issuer: c.issuer,
        certificateUrl: `https://certificados.${ascii(c.issuer).replace(/[^a-z0-9]+/g, '')}.org/${profile.id.slice(0, 8)}`,
        issueDate: `2026-0${(i % 9) + 1}-15`,
      }));
    }
  }

  // ---- Constancias internas (autorizadas por docente) ----
  for (let i = 0; i < 4; i++) {
    const p = studentProfiles[i];
    const act = activities[i % activities.length];
    const reg = await regRepo.findOne({ where: { activityId: act.id, studentProfileId: p.id } });
    const exists = await constancyRepo.findOne({ where: { studentProfileId: p.id, activityId: act.id } });
    if (!exists) {
      await constancyRepo.save(constancyRepo.create({
        studentProfileId: p.id,
        activityId: act.id,
        activityRegistrationId: reg ? reg.id : null,
        description: `Participación confirmada en ${act.title}.`,
        status: ConstancyStatus.AUTHORIZED,
        authorizedById: act.creatorId,
      }));
    }
  }

  // ---- Completitud + afinidad real para cada estudiante ----
  for (const p of studentProfiles) {
    await profilesService.recomputeCompletion(p.id);
    await engine.recalculate(p.id);
  }

  const totalUsers = await userRepo.count();
  console.log('\nBase poblada con cuentas institucionales:');
  console.log(`  Usuarios totales: ${totalUsers}  (1 administrador único + ${STAFF.length} administrativos/docentes + ${STUDENT_NAMES.length} estudiantes)`);
  console.log(`  Actividades: ${activities.length}  ·  Proyectos: ${PROJECTS.length}  ·  Certificados: ${CERTS.length}`);
  console.log('\n  Contraseña de todas las cuentas pobladas: ' + PWD);
  console.log('  Administrador: admin@univalle.edu / Admin123*');
  console.log('  Ejemplos:  carlos.perez@univalle.edu (docente) · jorge.vargas@univalle.edu (director)');
  console.log('             lucia.fernandez@univalle.edu (sociedad) · ana.quispe@est.univalle.edu (estudiante)\n');

  await app.close();
}

run().catch((e) => {
  console.error('Error al poblar la base:', e);
  process.exit(1);
});
