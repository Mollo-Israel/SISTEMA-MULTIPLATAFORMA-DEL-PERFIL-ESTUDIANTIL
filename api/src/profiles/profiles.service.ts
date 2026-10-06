import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Not, Repository } from 'typeorm';
import {
  DEFAULT_PUBLIC_VISIBILITY,
  InterestSource,
  ProfileStatus,
  ProjectVisibility,
  PUBLIC_PROFILE_FIELDS,
  PublicProfileField,
  RegistrationStatus,
  RolNombre,
  SkillInterestKind,
  SkillInterestSource,
  UserStatus,
  normalizeUniversityCode,
  universityCodeProblem,
} from '@perfil/shared';
import { StudentProfile } from '../entities/student-profile.entity';
import { User } from '../entities/user.entity';
import { StudentInterest } from '../entities/student-interest.entity';
import { StudentFreeInterest } from '../entities/student-free-interest.entity';
import { StudentSkillInterest } from '../entities/student-skill-interest.entity';
import { AcademicArea } from '../entities/academic-area.entity';
import { Skill } from '../entities/skill.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ProjectEvidence } from '../entities/project-evidence.entity';
import { ActivityRegistration } from '../entities/activity-registration.entity';
import { ExternalCertificate } from '../entities/external-certificate.entity';
import { InternalConstancy } from '../entities/internal-constancy.entity';
import { AffinityResult } from '../entities/affinity-result.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TeacherScopeService } from '../access/teacher-scope.service';
import { CreateFreeInterestDto, UpdateFreeInterestDto } from './dto/free-interest.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InterestItemDto } from './dto/set-interests.dto';
import { SetInstitutionalDataDto } from './dto/institutional-data.dto';
import { UpdateVisibilityDto } from './dto/visibility.dto';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { BackedSkillsService } from '../backed-skills/backed-skills.service';
import {
  TRAJECTORY_RECALCULATION,
  TrajectoryRecalculationPort,
} from '../trajectory/trajectory-recalculation.port';

interface StudentDirectoryRow {
  profileId: string;
  studentName: string;
  email: string;
  semester: number | null;
  status: string;
  completionPercentage: number;
}

/** Resultados maximos de la busqueda de companeros entre estudiantes. */
const PEER_SEARCH_LIMIT = 20;

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
    @InjectRepository(StudentInterest) private readonly interests: Repository<StudentInterest>,
    @InjectRepository(StudentFreeInterest)
    private readonly freeInterests: Repository<StudentFreeInterest>,
    @InjectRepository(StudentSkillInterest)
    private readonly skillInterests: Repository<StudentSkillInterest>,
    @InjectRepository(AcademicArea) private readonly areas: Repository<AcademicArea>,
    @InjectRepository(Skill) private readonly skillCatalog: Repository<Skill>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember) private readonly projectMembers: Repository<ProjectMember>,
    @InjectRepository(ProjectEvidence) private readonly evidences: Repository<ProjectEvidence>,
    @InjectRepository(ActivityRegistration)
    private readonly registrations: Repository<ActivityRegistration>,
    @InjectRepository(ExternalCertificate)
    private readonly certificates: Repository<ExternalCertificate>,
    @InjectRepository(InternalConstancy)
    private readonly constancies: Repository<InternalConstancy>,
    @InjectRepository(AffinityResult) private readonly affinities: Repository<AffinityResult>,
    @Inject(TRAJECTORY_RECALCULATION)
    private readonly trajectory: TrajectoryRecalculationPort,
    private readonly teacherScope: TeacherScopeService,
    private readonly audit: AuditService,
    private readonly backedSkills: BackedSkillsService,
  ) {}

  async createMyProfile(userId: string, dto: CreateProfileDto): Promise<StudentProfile> {
    const existing = await this.profiles.findOne({ where: { userId } });
    if (existing?.claimedAt) {
      throw new ConflictException('El estudiante ya tiene un perfil creado.');
    }
    await this.assertAreasExist(dto.improvementAreaIds);

    // Ni semestre ni codigo universitario: §17.1 los declara
    // institucionales. Llegan por importacion de padron o los fija el
    // administrador al dar de alta, nunca el propio estudiante.
    //
    // Si la institución ya creó el perfil con esos datos, el estudiante lo
    // completa; antes chocaba con él y el alta manual dejaba al estudiante
    // sin forma de tener semestre.
    // Un perfil nuevo copia de la cuenta su código y su semestre, que fijó la
    // institución: el perfil guarda una copia sincronizada.
    const cuenta = existing
      ? null
      : await this.profiles.manager.getRepository(User).findOne({
        where: { id: userId },
        select: { id: true, universityCode: true, semester: true },
      });
    const profile =
      existing
      ?? this.profiles.create({
        userId,
        universityCode: cuenta?.universityCode ?? null,
        semester: cuenta?.semester ?? null,
        status: ProfileStatus.INCOMPLETE,
        completionPercentage: 0,
      });
    profile.bio = dto.bio ?? profile.bio ?? null;
    profile.improvementAreaIds = dto.improvementAreaIds ?? profile.improvementAreaIds ?? null;
    profile.claimedAt = new Date();
    profile.onboardingStep = profile.onboardingStep ?? 'profile';

    const saved = await this.profiles.save(profile);
    await this.refreshCompletion(saved.id);
    await this.requestAffinity(saved.id);
    return this.getOwnProfile(userId);
  }

  // ---------------------------------------------------------------------
  //  Asistente de bienvenida
  // ---------------------------------------------------------------------

  /**
   * Dónde está el estudiante dentro de la bienvenida.
   *
   * La bienvenida son tres pasos —su perfil, sus intereses y habilidades, y el
   * cuestionario opcional— y hasta terminarla la web no le muestra el resto
   * del sistema: casi todo depende de tener el perfil, y entrar a pantallas
   * vacías era justo lo que dejaba a un estudiante nuevo sin saber por dónde
   * empezar.
   */
  async onboardingState(userId: string) {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      return {
        completed: false,
        completedAt: null,
        step: 'welcome',
        hasProfile: false,
        claimed: false,
        semester: null,
        universityCode: null,
        institutionalConfirmed: false,
        privacyReviewed: false,
        availabilityDecided: false,
        counts: { improvementAreas: 0, interests: 0, skillInterests: 0, skillsToImprove: 0, questionnaireRuns: 0 },
        missing: this.faltantesBienvenida(null, 0, 0, 0),
      };
    }
    const [interests, skillInterests, skillsToImprove, runs] = await Promise.all([
      this.interests.count({ where: { studentProfileId: profile.id } }),
      this.skillInterests.count({ where: { studentProfileId: profile.id, kind: SkillInterestKind.INTEREST } }),
      this.skillInterests.count({ where: { studentProfileId: profile.id, kind: SkillInterestKind.IMPROVE } }),
      this.profiles.manager.query(
        'SELECT count(*)::int AS n FROM onboarding_runs WHERE student_profile_id = $1',
        [profile.id],
      ),
    ]);
    const improvementAreas = profile.improvementAreaIds?.length ?? 0;
    return {
      completed: !!profile.onboardingCompletedAt,
      completedAt: profile.onboardingCompletedAt,
      step: profile.onboardingStep ?? (profile.claimedAt ? 'profile' : 'welcome'),
      hasProfile: true,
      claimed: !!profile.claimedAt,
      semester: profile.semester,
      universityCode: profile.universityCode,
      institutionalConfirmed: !!profile.institutionalConfirmedAt,
      privacyReviewed: !!profile.privacyReviewedAt,
      availabilityDecided: !!profile.availabilityDecidedAt,
      counts: {
        improvementAreas,
        interests,
        skillInterests,
        skillsToImprove,
        questionnaireRuns: Number(runs?.[0]?.n ?? 0),
      },
      missing: this.faltantesBienvenida(profile, interests, improvementAreas, skillInterests + skillsToImprove),
    };
  }

  /**
   * Lo obligatorio de la bienvenida V2 (§20.2), en lenguaje del estudiante:
   *
   *   - confirmar sus datos institucionales;
   *   - al menos un interés o un área de mejora (área o tecnología);
   *   - revisar su privacidad básica;
   *   - decidir su disponibilidad (aunque sea «prefiero no decirlo»).
   *
   * La biografía y el cuestionario son opcionales.
   */
  private faltantesBienvenida(
    profile: StudentProfile | null,
    interests: number,
    improvementAreas: number,
    skillInterests: number,
  ): string[] {
    const faltan: string[] = [];
    if (!profile?.institutionalConfirmedAt) faltan.push('confirmar tus datos institucionales');
    if (interests + improvementAreas + skillInterests === 0) {
      faltan.push('elegir al menos un interés o un área que quieras mejorar');
    }
    if (!profile?.availabilityDecidedAt) faltan.push('indicar tu disponibilidad para colaborar');
    if (!profile?.privacyReviewedAt) faltan.push('revisar tu privacidad');
    return faltan;
  }

  /** Guarda por qué paso va, para retomarlo donde lo dejó. */
  async saveOnboardingStep(userId: string, step: string) {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Primero confirma tus datos: es el primer paso de la bienvenida.');
    }
    profile.onboardingStep = step;
    await this.profiles.save(profile);
    return this.onboardingState(userId);
  }

  /**
   * Paso 1 (§20.2): el estudiante vio su semestre y su código universitario y
   * confirma que son correctos. No puede cambiarlos (§6.1); si no lo son, lo
   * corrige la administración. Reclama el perfil que creó el alta.
   */
  async confirmInstitutionalData(userId: string, bio?: string) {
    let profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      await this.createMyProfile(userId, { bio } as CreateProfileDto);
      profile = await this.getOwnProfile(userId);
    } else if (bio !== undefined) {
      profile.bio = bio || null;
    }
    profile.claimedAt ??= new Date();
    profile.institutionalConfirmedAt ??= new Date();
    if (!profile.onboardingStep || profile.onboardingStep === 'welcome') profile.onboardingStep = 'interests';
    await this.profiles.save(profile);
    await this.refreshCompletion(profile.id);
    return this.onboardingState(userId);
  }

  /**
   * Paso 4 (§20.2): privacidad básica. Si aparece como posible compañero en
   * las sugerencias de otros y si activa su perfil compartible. Ambas cosas
   * se pueden cambiar después en «Privacidad».
   */
  async saveOnboardingPrivacy(
    userId: string,
    dto: { peerDiscoverable: boolean; publicProfileEnabled: boolean },
  ) {
    const profile = await this.getOwnProfile(userId);
    profile.peerDiscoverable = dto.peerDiscoverable;
    profile.publicProfileEnabled = dto.publicProfileEnabled;
    profile.privacyReviewedAt = new Date();
    await this.profiles.save(profile);
    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.VISIBILITY_CHANGED,
      entityType: 'student_profile',
      entityId: profile.id,
      metadata: { publicProfileEnabled: dto.publicProfileEnabled, peerDiscoverable: dto.peerDiscoverable, origen: 'bienvenida' },
    });
    return this.onboardingState(userId);
  }

  /** Da la bienvenida por terminada si está lo obligatorio de §20.2. */
  async completeOnboarding(userId: string) {
    const estado = await this.onboardingState(userId);
    if (estado.missing.length > 0) {
      throw new BadRequestException({
        message: `Para terminar la bienvenida falta ${estado.missing.join(', ')}.`,
        details: { missing: estado.missing },
      });
    }
    if (!estado.completed) {
      await this.profiles.update(
        { userId },
        { onboardingCompletedAt: new Date(), onboardingStep: 'done' },
      );
    }
    return this.onboardingState(userId);
  }

  async getOwnProfile(userId: string): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return profile;
  }

  /**
   * Directorio de estudiantes para docente, director y administrador.
   *
   * El docente solo ve los semestres que el administrador le habilito (RF3);
   * director y administrador ven la cohorte completa. La respuesta indica el
   * alcance aplicado para que la interfaz pueda explicarlo al usuario en vez de
   * mostrar una lista vacia sin motivo.
   */
  async listStudents(user: AuthenticatedUser, search?: string) {
    const scope = await this.teacherScope.scopeFor(user);
    const restricted = scope !== null;

    if (restricted && scope.length === 0) {
      return {
        scope: { restricted: true, semesters: [] as number[] },
        students: [] as StudentDirectoryRow[],
      };
    }

    const qb = this.profiles
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .select('p.id', 'profileId')
      .addSelect('p.semester', 'semester')
      .addSelect('p.status', 'status')
      .addSelect('p.completion_percentage', 'completionPercentage')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'studentName')
      .addSelect('u.email', 'email')
      .orderBy('p.semester', 'ASC')
      .addOrderBy('u.first_name', 'ASC')
      .addOrderBy('u.last_name', 'ASC');

    if (restricted) {
      qb.andWhere('p.semester IN (:...semesters)', { semesters: scope });
    }

    const term = search?.trim();
    if (term) {
      qb.andWhere(
        "(u.first_name ILIKE :s OR u.last_name ILIKE :s OR u.email ILIKE :s OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :s)",
        { s: `%${term}%` },
      );
    }

    const rows = await qb.getRawMany();
    return {
      scope: { restricted, semesters: scope ?? [] },
      students: rows.map((r) => ({
        profileId: r.profileId,
        studentName: r.studentName,
        email: r.email,
        semester: r.semester,
        status: r.status,
        completionPercentage: Number(r.completionPercentage),
      })),
    };
  }

  /**
   * Busqueda de companeros entre estudiantes (RF14, y base de RF18).
   *
   * Corrige un defecto del Objetivo 5: la pantalla de invitar integrantes usaba
   * el directorio institucional, reservado a docente, director y administrador.
   * Un estudiante recibia 403 y la lista de candidatos salia siempre vacia.
   *
   * Devuelve una tarjeta minima: nombre y semestre. Sin correo, sin puntajes y
   * sin proyectos. Excluye al propio estudiante y a las cuentas inactivas, y
   * limita el resultado para que no sirva como listado masivo.
   *
   * La preferencia peerDiscoverable NO se aplica aqui. Gobierna las sugerencias
   * que el sistema hace por su cuenta; una invitacion es una accion dirigida y
   * sigue requiriendo que el invitado acepte (RF14).
   */
  async searchPeers(user: AuthenticatedUser, search: string) {
    // Se escapan los comodines de ILIKE: sin esto, buscar "%%" cumpliria el
    // minimo de dos caracteres y devolveria a cualquier estudiante.
    const term = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

    const rows = await this.profiles
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .select('p.id', 'profileId')
      .addSelect("CONCAT(u.first_name, ' ', u.last_name)", 'studentName')
      .addSelect('p.semester', 'semester')
      .where('u.id <> :me', { me: user.userId })
      .andWhere('u.status = :active', { active: UserStatus.ACTIVE })
      .andWhere(
        "(u.first_name ILIKE :term OR u.last_name ILIKE :term OR CONCAT(u.first_name, ' ', u.last_name) ILIKE :term)",
        { term },
      )
      .orderBy('u.first_name', 'ASC')
      .addOrderBy('u.last_name', 'ASC')
      .limit(PEER_SEARCH_LIMIT)
      .getRawMany<{ profileId: string; studentName: string; semester: number | null }>();

    return rows.map((r) => ({
      profileId: r.profileId,
      studentName: r.studentName,
      semester: r.semester === null ? null : Number(r.semester),
    }));
  }

  async updateMyProfile(userId: string, dto: UpdateProfileDto): Promise<StudentProfile> {
    const profile = await this.getOwnProfile(userId);
    // Escribir en el perfil es reclamarlo: el que creó la institución pasa a
    // ser del estudiante en cuanto este lo toca.
    profile.claimedAt ??= new Date();
    if (dto.improvementAreaIds !== undefined) {
      await this.assertAreasExist(dto.improvementAreaIds);
      profile.improvementAreaIds = dto.improvementAreaIds;
    }
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.peerDiscoverable !== undefined) profile.peerDiscoverable = dto.peerDiscoverable;
    if (dto.availability !== undefined) {
      profile.availability = dto.availability;
      // Decidir —aunque sea «prefiero no decirlo»— es lo que pide §20.2.
      profile.availabilityDecidedAt = new Date();
    }
    if (dto.collaborationPreferences !== undefined) {
      profile.collaborationPreferences = {
        modes: dto.collaborationPreferences.modes ?? [],
        interests: dto.collaborationPreferences.interests ?? [],
        hoursPerWeek: dto.collaborationPreferences.hoursPerWeek ?? null,
        notes: dto.collaborationPreferences.notes ?? null,
      };
    }
    await this.profiles.save(profile);
    await this.refreshCompletion(profile.id);
    await this.requestAffinity(profile.id);
    return this.getOwnProfile(userId);
  }

  async addInterests(userId: string, items: InterestItemDto[]): Promise<StudentInterest[]> {
    const profile = await this.getOwnProfile(userId);
    await this.assertAreasExist(items.map((i) => i.academicAreaId));
    for (const item of items) {
      const existing = await this.interests.findOne({
        where: { studentProfileId: profile.id, academicAreaId: item.academicAreaId },
      });
      if (existing) {
        existing.priority = item.priority;
        await this.interests.save(existing);
      } else {
        await this.interests.save(
          this.interests.create({
            studentProfileId: profile.id,
            academicAreaId: item.academicAreaId,
            priority: item.priority,
            source: InterestSource.MANUAL,
          }),
        );
      }
    }
    await this.afterProfileChange(profile.id);
    return this.interests.find({
      where: { studentProfileId: profile.id },
      relations: { academicArea: true },
    });
  }

  async replaceInterests(userId: string, items: InterestItemDto[]): Promise<StudentInterest[]> {
    const profile = await this.getOwnProfile(userId);
    await this.assertAreasExist(items.map((i) => i.academicAreaId));
    await this.interests.delete({ studentProfileId: profile.id });
    if (items.length > 0) {
      await this.interests.save(
        items.map((item) =>
          this.interests.create({
            studentProfileId: profile.id,
            academicAreaId: item.academicAreaId,
            priority: item.priority,
            source: InterestSource.MANUAL,
          }),
        ),
      );
    }
    await this.afterProfileChange(profile.id);
    return this.interests.find({
      where: { studentProfileId: profile.id },
      relations: { academicArea: true },
    });
  }

  /**
   * Nivel autodeclarado de habilidad: retirado (V2 §22).
   *
   * El estudiante ya no declara «básico / intermedio / avanzado» como señal de
   * competencia. Las llamadas antiguas reciben 410 con la ruta nueva, en vez
   * de seguir escribiendo una tabla que ningún motor debe leer.
   */
  retiredSelfSkillLevel(): never {
    throw new GoneException(
      'El nivel autodeclarado de habilidades se retiró (especificación V2 §22). '
        + 'Declara qué tecnologías te interesan o quieres mejorar en /profiles/me/skill-interests.',
    );
  }

  async getSkillInterests(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.listSkillInterests(profile.id);
  }

  private listSkillInterests(profileId: string) {
    return this.skillInterests
      .find({
        where: { studentProfileId: profileId },
        relations: { skill: true },
        order: { createdAt: 'ASC' },
      })
      .then((filas) =>
        filas.map((f) => ({
          skillId: f.skillId,
          skill: f.skill?.name ?? null,
          academicAreaId: f.skill?.academicAreaId ?? null,
          kind: f.kind,
          source: f.source,
        })),
      );
  }

  /**
   * Reemplaza la lista de tecnologías de interés (V2 §21). Reemplazo completo,
   * como con las áreas: así quitar una es simplemente no enviarla.
   */
  async replaceSkillInterests(
    userId: string,
    items: { skillId: string; kind: SkillInterestKind }[],
  ) {
    const profile = await this.getOwnProfile(userId);
    const unicos = new Map(items.map((i) => [i.skillId, i.kind]));
    await this.assertSkillsExist([...unicos.keys()]);
    const previos = new Map(
      (await this.skillInterests.find({ where: { studentProfileId: profile.id } })).map((p) => [p.skillId, p]),
    );
    await this.skillInterests.manager.transaction(async (manager) => {
      const repo = manager.getRepository(StudentSkillInterest);
      await repo.delete({ studentProfileId: profile.id });
      if (unicos.size > 0) {
        await repo.save(
          [...unicos.entries()].map(([skillId, kind]) =>
            repo.create({
              studentProfileId: profile.id,
              skillId,
              kind,
              // Conservar la procedencia de lo que ya estaba: una preferencia
              // migrada o confirmada desde la orientación sigue siéndolo.
              source: previos.get(skillId)?.source ?? SkillInterestSource.DECLARED,
            }),
          ),
        );
      }
    });
    profile.claimedAt ??= new Date();
    await this.profiles.save(profile);
    await this.refreshCompletion(profile.id);
    return this.listSkillInterests(profile.id);
  }

  // ---------------------------------------------------------------------
  // Intereses en texto libre (RF5)
  //
  // Distintos de las areas de preferencia: son temas escritos por el propio
  // estudiante, sin depender del catalogo de areas academicas.
  // ---------------------------------------------------------------------

  async listFreeInterests(userId: string): Promise<StudentFreeInterest[]> {
    const profile = await this.getOwnProfile(userId);
    return this.freeInterests.find({
      where: { studentProfileId: profile.id },
      order: { createdAt: 'ASC' },
    });
  }

  async addFreeInterest(
    userId: string,
    dto: CreateFreeInterestDto,
  ): Promise<StudentFreeInterest> {
    const profile = await this.getOwnProfile(userId);
    await this.assertFreeInterestNameFree(profile.id, dto.name);
    if ((await this.freeInterests.count({ where: { studentProfileId: profile.id } })) >= 30) {
      throw new BadRequestException('Puedes registrar como máximo 30 intereses.');
    }
    const saved = await this.freeInterests.save(
      this.freeInterests.create({
        studentProfileId: profile.id,
        name: dto.name,
        description: dto.description ?? null,
      }),
    );
    await this.afterProfileChange(profile.id);
    return saved;
  }

  async updateFreeInterest(
    userId: string,
    id: string,
    dto: UpdateFreeInterestDto,
  ): Promise<StudentFreeInterest> {
    const profile = await this.getOwnProfile(userId);
    const interest = await this.requireOwnFreeInterest(profile.id, id);
    if (dto.name !== undefined && dto.name.toLowerCase() !== interest.name.toLowerCase()) {
      await this.assertFreeInterestNameFree(profile.id, dto.name, id);
      interest.name = dto.name;
    }
    if (dto.description !== undefined) interest.description = dto.description ?? null;
    const saved = await this.freeInterests.save(interest);
    await this.afterProfileChange(profile.id);
    return saved;
  }

  async removeFreeInterest(userId: string, id: string): Promise<void> {
    const profile = await this.getOwnProfile(userId);
    const interest = await this.requireOwnFreeInterest(profile.id, id);
    await this.freeInterests.delete(interest.id);
    await this.afterProfileChange(profile.id);
  }

  private async requireOwnFreeInterest(
    profileId: string,
    id: string,
  ): Promise<StudentFreeInterest> {
    const interest = await this.freeInterests.findOne({ where: { id } });
    if (!interest) {
      throw new NotFoundException('Interés no encontrado.');
    }
    if (interest.studentProfileId !== profileId) {
      throw new ForbiddenException('Solo puedes gestionar tus propios intereses.');
    }
    return interest;
  }

  private async assertFreeInterestNameFree(
    profileId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const existing = await this.freeInterests.findOne({
      where: exceptId
        ? { studentProfileId: profileId, name: ILike(name), id: Not(exceptId) }
        : { studentProfileId: profileId, name: ILike(name) },
    });
    if (existing) {
      throw new ConflictException('Ya registraste ese interés.');
    }
  }

  // ---------------------------------------------------------------------
  //  Datos institucionales (§17.1)
  // ---------------------------------------------------------------------

  /**
   * Fija semestre y código universitario de un estudiante.
   *
   * Solo el administrador. Normalmente estos datos llegan por importación de
   * padrón; esto cubre el alta manual y la corrección puntual sin obligar a
   * reimportar el padrón entero.
   */
  async setInstitutionalData(
    profileId: string,
    dto: SetInstitutionalDataDto,
    actorUserId: string,
  ): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) throw new NotFoundException('Perfil no encontrado.');

    const antes = { semester: profile.semester, universityCode: profile.universityCode };

    if (dto.universityCode !== undefined) {
      const problema = universityCodeProblem(dto.universityCode, RolNombre.STUDENT);
      if (problema) {
        throw new BadRequestException({ message: problema, fields: { universityCode: [problema] } });
      }
      const codigo = normalizeUniversityCode(dto.universityCode);
      // Único entre todas las cuentas, no solo entre estudiantes.
      const enUso = await this.profiles.manager.getRepository(User).findOne({
        where: { universityCode: codigo, id: Not(profile.userId) },
        select: { id: true },
      });
      if (enUso) {
        throw new ConflictException('Ese código universitario ya pertenece a otra cuenta.');
      }
      profile.universityCode = codigo;
    }
    if (dto.semester !== undefined) profile.semester = dto.semester;

    // La cuenta y el perfil cambian juntos: el perfil guarda una copia.
    await this.profiles.manager.transaction(async (manager) => {
      await manager.getRepository(StudentProfile).save(profile);
      await manager.getRepository(User).update(
        { id: profile.userId },
        {
          ...(profile.universityCode ? { universityCode: profile.universityCode } : {}),
          semester: profile.semester,
        },
      );
    });
    // Cambiar el semestre mueve al estudiante dentro o fuera del alcance de un
    // docente, asi que queda registrado quien lo hizo.
    await this.audit.record({
      actorUserId,
      eventType: AuditEventType.INSTITUTIONAL_DATA_CHANGED,
      entityType: 'student_profile',
      entityId: profile.id,
      metadata: {
        antes,
        despues: { semester: profile.semester, universityCode: profile.universityCode },
      },
    });

    await this.refreshCompletion(profile.id);
    return this.profiles.findOne({ where: { id: profile.id } }) as Promise<StudentProfile>;
  }

  // ---------------------------------------------------------------------
  //  Privacidad (§44)
  // ---------------------------------------------------------------------

  /** Lo que el estudiante comparte hoy, con la lista completa de campos posibles. */
  async getVisibility(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.visibilityView(profile);
  }

  /**
   * Cambia qué se comparte (§44).
   *
   * Solo se aceptan las claves de `PublicProfileField`. Lo que nunca es
   * publicable —correo institucional, archivos privados, identificadores
   * internos— no tiene clave, de modo que ninguna petición puede activarlo.
   */
  async updateVisibility(userId: string, dto: UpdateVisibilityDto) {
    const profile = await this.getOwnProfile(userId);

    if (dto.publicProfileEnabled !== undefined) {
      profile.publicProfileEnabled = dto.publicProfileEnabled;
    }
    profile.privacyReviewedAt = new Date();
    if (dto.fields) {
      const actual = { ...DEFAULT_PUBLIC_VISIBILITY, ...(profile.publicVisibilityConfig ?? {}) };
      for (const field of PUBLIC_PROFILE_FIELDS) {
        const valor = (dto.fields as Record<string, boolean | undefined>)[field];
        if (valor !== undefined) actual[field] = valor;
      }
      profile.publicVisibilityConfig = actual;
    }

    await this.profiles.save(profile);
    await this.audit.record({
      actorUserId: userId,
      eventType: AuditEventType.VISIBILITY_CHANGED,
      entityType: 'student_profile',
      entityId: profile.id,
      metadata: {
        publicProfileEnabled: profile.publicProfileEnabled,
        campos: profile.publicVisibilityConfig,
      },
    });
    return this.visibilityView(profile);
  }

  private visibilityView(profile: StudentProfile) {
    const config = { ...DEFAULT_PUBLIC_VISIBILITY, ...(profile.publicVisibilityConfig ?? {}) };
    return {
      publicProfileEnabled: profile.publicProfileEnabled,
      fields: config,
      /**
       * Lo que nunca se comparte, dígase lo que se diga en `fields`. Se
       * devuelve para que la interfaz pueda mostrarlo y el estudiante sepa
       * qué queda fuera sin tener que confiar en que así sea.
       */
      neverShared: [
        'correo institucional',
        'código universitario',
        'archivos y certificados privados',
        'conversaciones',
        'identificadores internos',
      ],
    };
  }

  async getSummary(userId: string) {
    const profile = await this.getOwnProfile(userId);
    return this.buildSummary(profile, { includeInternal: true });
  }

  /**
   * Vista permitida de un perfil para roles institucionales.
   *
   * Aplica el alcance por semestre del docente y recorta la informacion: no se
   * exponen identificadores internos de proyectos y actividades, ni el correo,
   * ni las constancias internas, que solo ve el propio estudiante.
   */
  async getAllowedView(user: AuthenticatedUser, profileId: string) {
    const profile = await this.teacherScope.assertCanAccessProfile(user, profileId);
    const summary = await this.buildSummary(profile, { includeInternal: false });
    return {
      profileId: profile.id,
      studentName: profile.user ? `${profile.user.firstName} ${profile.user.lastName}` : null,
      semester: profile.semester,
      status: profile.status,
      bio: profile.bio,
      improvementAreas: summary.improvementAreas,
      freeInterests: summary.freeInterests,
      preferredAreas: summary.preferredAreas,
      interests: summary.interests,
      skills: summary.skills,
      // Un proyecto privado no sale del circulo del estudiante y sus
      // integrantes: no aparece en la vista que consultan los roles
      // institucionales (RF13, nivel de visibilidad).
      projects: summary.projects
        .filter((p) => p.visibility !== ProjectVisibility.PRIVATE)
        .map((p) => ({
          title: p.title,
          status: p.status,
          technologies: p.technologies,
          visibility: p.visibility,
        })),
      activities: summary.activities.map((a) => ({
        title: a.title,
        type: a.type,
        status: a.status,
      })),
      externalCertificates: summary.externalCertificates.map((c) => ({
        certificateName: c.certificateName,
        issuer: c.issuer,
      })),
      affinities: summary.affinities,
    };
  }

  private async buildSummary(
    profile: StudentProfile,
    options: { includeInternal: boolean },
  ) {
    const [interests, freeInterests, backed, ownedProjects, memberships, certificates, affinities] =
      await Promise.all([
        this.interests.find({
          where: { studentProfileId: profile.id },
          relations: { academicArea: true },
          order: { priority: 'DESC' },
        }),
        this.freeInterests.find({
          where: { studentProfileId: profile.id },
          order: { createdAt: 'ASC' },
        }),
        this.backedSkills.forProfile(profile.id),
        this.projects.find({ where: { createdByProfileId: profile.id } }),
        this.projectMembers.find({
          where: { userId: profile.userId },
          relations: { project: true },
        }),
        this.certificates.find({ where: { studentProfileId: profile.id } }),
        this.affinities.find({
          where: { studentProfileId: profile.id },
          relations: { academicArea: true },
          order: { score: 'DESC' },
        }),
      ]);

    const projectsMap = new Map<string, Project>();
    ownedProjects.forEach((p) => projectsMap.set(p.id, p));
    memberships.forEach((m) => {
      if (m.project) projectsMap.set(m.project.id, m.project);
    });
    const projects = [...projectsMap.values()];
    const projectIds = projects.map((p) => p.id);

    // Las evidencias pertenecen al perfil, no al proyecto: una evidencia puede
    // respaldar una actividad o un area sin estar ligada a ningun proyecto.
    const [evidences, registrations] = await Promise.all([
      this.evidences.find({
        where: { studentProfileId: profile.id },
        relations: { activity: true, academicArea: true },
        order: { createdAt: 'DESC' },
      }),
      this.registrations.find({
        where: { studentProfileId: profile.id },
        relations: { activity: true },
      }),
    ]);
    void projectIds;

    const improvementAreas = await this.resolveAreas(profile.improvementAreaIds);

    const summary = {
      profile: {
        id: profile.id,
        universityCode: profile.universityCode,
        semester: profile.semester,
        bio: profile.bio,
        status: profile.status,
        completionPercentage: profile.completionPercentage,
      },
      improvementAreas,
      /** Intereses en texto libre declarados por el estudiante (RF5). */
      freeInterests: freeInterests.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
      })),
      /**
       * Areas de preferencia: seleccion del catalogo de areas academicas con
       * prioridad. Se expone tambien como `interests` por compatibilidad con
       * los clientes anteriores.
       */
      preferredAreas: interests.map((i) => ({
        academicAreaId: i.academicAreaId,
        area: i.academicArea?.name ?? null,
        priority: i.priority,
        /** De donde salio (§18): del catalogo o del cuestionario. */
        source: i.source,
      })),
      interests: interests.map((i) => ({
        academicAreaId: i.academicAreaId,
        area: i.academicArea?.name ?? null,
        priority: i.priority,
        source: i.source,
      })),
      /**
       * Tecnologías respaldadas por trayectoria (V2 §22, §34): las que el
       * estudiante usó en proyectos con respaldo (contribución confirmada) o
       * en actividades con participación confirmada. Ya no hay nivel
       * autodeclarado.
       */
      skills: backed.map((b) => ({
        skillId: b.skillId,
        skill: b.name,
        academicAreaId: b.academicAreaId,
        sources: b.sources,
        evidenceCount: b.evidenceCount,
      })),
      /** Tecnologías que le interesan o quiere mejorar (declarativo, V2 §21). */
      skillInterests: await this.listSkillInterests(profile.id),
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        technologies: p.technologies,
        visibility: p.visibility,
        /** true si el estudiante es el responsable; false si participa como integrante aceptado. */
        isOwner: p.createdByProfileId === profile.id,
      })),
      evidences: evidences.map((e) => ({
        id: e.id,
        description: e.description,
        evidenceType: e.evidenceType,
        fileUrl: e.fileUrl,
        fileName: e.fileName,
        mimeType: e.mimeType,
        fileSize: e.fileSize,
        externalUrl: e.externalUrl,
        projectId: e.projectId,
        activityId: e.activityId,
        activity: e.activity?.title ?? null,
        academicAreaId: e.academicAreaId,
        area: e.academicArea?.name ?? null,
        createdAt: e.createdAt,
      })),
      activities: registrations.map((r) => ({
        registrationId: r.id,
        activityId: r.activityId,
        title: r.activity?.title ?? null,
        type: r.activity?.type ?? null,
        status: r.status,
      })),
      externalCertificates: certificates.map((c) => ({
        id: c.id,
        certificateName: c.certificateName,
        issuer: c.issuer,
        certificateUrl: c.certificateUrl,
        issueDate: c.issueDate,
      })),
      affinities: affinities.map((a) => ({
        academicAreaId: a.academicAreaId,
        area: a.academicArea?.name ?? null,
        score: Number(a.score),
        level: a.level,
      })),
      internalConstancies: [] as Array<{
        id: string;
        description: string;
        status: string;
        activityId: string | null;
      }>,
    };

    if (options.includeInternal) {
      const constancies = await this.constancies.find({
        where: { studentProfileId: profile.id },
      });
      summary.internalConstancies = constancies.map((c) => ({
        id: c.id,
        description: c.description,
        status: c.status,
        activityId: c.activityId,
      }));
    }

    return summary;
  }

  private async afterProfileChange(profileId: string): Promise<void> {
    await this.refreshCompletion(profileId);
    await this.requestAffinity(profileId);
  }

  recomputeCompletion(profileId: string): Promise<void> {
    return this.refreshCompletion(profileId);
  }

  private async refreshCompletion(profileId: string): Promise<void> {
    const profile = await this.profiles.findOne({ where: { id: profileId } });
    if (!profile) return;

    const [interestCount, skillCount] = await Promise.all([
      this.interests.count({ where: { studentProfileId: profileId } }),
      this.skillInterests.count({ where: { studentProfileId: profileId } }),
    ]);

    // El semestre sigue contando porque un perfil sin el esta incompleto de
    // verdad, pero ya no depende del estudiante: lo fija el padron. Si falta,
    // lo que hay que arreglar es la importacion, no pedirselo a el.
    let percentage = 0;
    if (profile.semester) percentage += 20;
    if (profile.bio && profile.bio.trim().length > 0) percentage += 20;
    if (interestCount > 0) percentage += 20;
    if (skillCount > 0) percentage += 20;
    if (profile.improvementAreaIds && profile.improvementAreaIds.length > 0) percentage += 20;

    profile.completionPercentage = percentage;
    if (percentage < 100) {
      profile.status = ProfileStatus.INCOMPLETE;
    } else if (profile.status === ProfileStatus.INCOMPLETE) {
      profile.status = ProfileStatus.ACTIVE;
    } else {
      profile.status = ProfileStatus.UPDATED;
    }
    await this.profiles.save(profile);
  }

  private async requestAffinity(profileId: string): Promise<void> {
    await this.trajectory.requestRecalculation(profileId);
  }

  private async resolveAreas(ids: string[] | null) {
    if (!ids || ids.length === 0) return [];
    const areas = await this.areas.find({ where: { id: In(ids) } });
    return areas.map((a) => ({ id: a.id, name: a.name }));
  }

  private async assertAreasExist(ids?: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const unique = [...new Set(ids)];
    const count = await this.areas.count({ where: { id: In(unique) } });
    if (count !== unique.length) {
      throw new BadRequestException('Una o más áreas académicas no existen.');
    }
  }

  private async assertSkillsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const unique = [...new Set(ids)];
    const count = await this.skillCatalog.count({ where: { id: In(unique) } });
    if (count !== unique.length) {
      throw new BadRequestException('Una o más habilidades no existen en el catálogo.');
    }
  }
}
