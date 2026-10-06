import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  RolNombre,
  SEMESTER_ROLES,
  UserStatus,
  normalizeUniversityCode,
  universityCodeProblem,
} from '@perfil/shared';
import { User } from '../entities/user.entity';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { RolesService } from '../roles/roles.service';
import { AuthSessionsService } from '../identity/auth-sessions.service';
import { AccountTokensService } from '../identity/account-tokens.service';
import { ActivationService } from '../identity/activation.service';
import { AccountMailService } from '../identity/account-mail.service';
import { MailService, maskEmail } from '../mail/mail.service';
import { AuditEventType, AuditService } from '../audit/audit.service';
import { deliveryStateOf, InvitationView, PublicUser, toPublicUser } from './types/public-user';

/** Lo que el alta espera al correo antes de responder. Después, «en cola». */
const ESPERA_INVITACION_MS = 6_000;

interface CreateUserParams {
  firstName: string;
  lastName: string;
  email: string;
  /** Si se omite, se guarda un hash aleatorio hasta que el titular active (§12). */
  password?: string;
  role: RolNombre;
  status?: UserStatus;
  /** Obligatorio para estudiantes: sin semestre el perfil no puede completarse. */
  semester?: number;
  universityCode?: string;
}

interface UpdateUserParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: RolNombre;
  status?: UserStatus;
  semester?: number;
  universityCode?: string;
}

/** Contexto minimo que los guards necesitan en cada peticion. */
export interface AuthContext {
  id: string;
  email: string;
  role: RolNombre;
  status: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(TeacherSemesterAccess)
    private readonly semesterAccess: Repository<TeacherSemesterAccess>,
    private readonly rolesService: RolesService,
    private readonly sessions: AuthSessionsService,
    private readonly accountTokens: AccountTokensService,
    private readonly activation: ActivationService,
    private readonly accountMail: AccountMailService,
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async create(params: CreateUserParams, actorUserId?: string): Promise<PublicUser> {
    const email = params.email.toLowerCase().trim();
    await this.assertEmailAvailable(email);

    const esEstudiante = params.role === RolNombre.STUDENT;
    const llevaSemestre = SEMESTER_ROLES.includes(params.role);
    // El semestre es un dato institucional (§17.1): quien cursa no puede
    // fijarlo, así que si no lo pone quien crea la cuenta, nadie lo pone.
    if (llevaSemestre && !params.semester) {
      throw new BadRequestException({
        message: 'Indique el semestre.',
        fields: { semester: ['Indique el semestre que cursa (1 a 8).'] },
      });
    }
    // Toda cuenta lleva su código universitario, con el prefijo de su rol.
    const universityCode = this.assertUniversityCodeFormat(params.universityCode, params.role);
    await this.assertUniversityCodeAvailable(universityCode);

    const role = await this.rolesService.findByName(params.role);
    // Sin contrasena declarada se guarda una aleatoria que nadie conoce: la
    // cuenta solo sera utilizable cuando su titular la active.
    const passwordHash = await bcrypt.hash(
      params.password ?? randomBytes(32).toString('hex'),
      10,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).save(
        manager.getRepository(User).create({
          firstName: params.firstName,
          lastName: params.lastName,
          email,
          passwordHash,
          roleId: role.id,
          universityCode,
          semester: llevaSemestre ? params.semester! : null,
          // §9.2: una cuenta nace provisionada. Quien la crea no fija la
          // contrasena definitiva; la fija su titular al activar.
          status: params.status ?? UserStatus.PENDING_ACTIVATION,
        }),
      );
      // Igual que la importación de padrón: el perfil nace con sus datos
      // institucionales, y el estudiante completa el resto al entrar.
      if (esEstudiante) {
        await manager.getRepository(StudentProfile).save(
          manager.getRepository(StudentProfile).create({
            userId: user.id,
            semester: params.semester!,
            universityCode,
          }),
        );
      }
      return user;
    });
    saved.role = role;

    await this.audit.record({
      actorUserId: actorUserId ?? null,
      eventType: AuditEventType.USER_PROVISIONED,
      entityType: 'user',
      entityId: saved.id,
      metadata: { email: saved.email, role: params.role, via: 'admin' },
    });

    const result = toPublicUser(saved);
    // Una cuenta provisionada necesita su invitación para poder usarse. Se
    // espera unos segundos al envío para decirle al administrador en qué
    // quedó; nunca se le devuelve el enlace ni el código.
    if (saved.status === UserStatus.PENDING_ACTIVATION) {
      const jobId = await this.activation.queueActivation(saved, actorUserId ?? null);
      result.invitation = await this.invitationOutcome(jobId, saved.email);
    }
    return result;
  }

  /** Espera brevemente al envío y lo describe para el administrador. */
  private async invitationOutcome(jobId: string, email: string): Promise<InvitationView> {
    const final = await this.accountMail.waitFor(jobId, ESPERA_INVITACION_MS);
    const simulated = this.mail.settings.transport === 'console';
    if (final === 'sent') {
      return { status: 'sent', deliveryState: 'SENT_TO_SMTP', sentTo: maskEmail(email), simulated, at: new Date() };
    }
    if (final === 'failed' || final === 'skipped') {
      const job = await this.accountMail.findJob(jobId);
      return {
        status: final, deliveryState: 'FAILED', sentTo: maskEmail(email), simulated, error: job?.lastError ?? null,
      };
    }
    return { status: 'queued', deliveryState: 'QUEUED', sentTo: maskEmail(email), simulated };
  }

  /**
   * Código normalizado (mayúsculas, sin espacios) o error de campo si no sigue
   * el formato `PREFIJO-XXXXXXX` con el prefijo del rol.
   */
  private assertUniversityCodeFormat(value: string | null | undefined, role: RolNombre): string {
    const problema = universityCodeProblem(value, role);
    if (problema) {
      throw new BadRequestException({ message: problema, fields: { universityCode: [problema] } });
    }
    return normalizeUniversityCode(value);
  }

  /** El código es único entre todas las cuentas. */
  private async assertUniversityCodeAvailable(code: string, exceptUserId?: string): Promise<void> {
    const enUso = await this.usersRepository.findOne({
      where: exceptUserId ? { universityCode: code, id: Not(exceptUserId) } : { universityCode: code },
      select: { id: true },
    });
    if (enUso) {
      throw new ConflictException({
        message: 'Ese código universitario ya pertenece a otra cuenta.',
        fields: { universityCode: ['Ese código universitario ya pertenece a otra cuenta.'] },
      });
    }
  }

  /** Listado administrativo con busqueda por nombre, apellido o correo. */
  async findAll(search?: string, role?: RolNombre): Promise<PublicUser[]> {
    const qb = this.usersRepository
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r')
      .orderBy('u.createdAt', 'DESC');

    const term = search?.trim();
    if (term) {
      qb.andWhere(
        "(u.firstName ILIKE :s OR u.lastName ILIKE :s OR u.email ILIKE :s OR CONCAT(u.firstName, ' ', u.lastName) ILIKE :s)",
        { s: `%${term}%` },
      );
    }
    if (role) {
      qb.andWhere('r.name = :role', { role });
    }
    const users = await qb.getMany();
    const result = users.map(toPublicUser);

    // Los semestres habilitados se resuelven en lote (sin consultas dentro del bucle).
    const teacherIds = result.filter((u) => u.role === RolNombre.TEACHER).map((u) => u.id);
    if (teacherIds.length > 0) {
      const byTeacher = await this.getSemestersForTeachers(teacherIds);
      for (const user of result) {
        if (user.role === RolNombre.TEACHER) user.semesters = byTeacher.get(user.id) ?? [];
      }
    }

    // Para las cuentas sin activar, en qué quedó su invitación: es lo que el
    // administrador necesita saber cuando alguien dice «no me llegó».
    const pendientes = result
      .filter((u) => u.status === UserStatus.PENDING_ACTIVATION)
      .map((u) => u.id);
    if (pendientes.length > 0) {
      const ultimos = await this.accountMail.latestFor(pendientes);
      const simulated = this.mail.settings.transport === 'console';
      for (const user of result) {
        const job = ultimos.get(user.id);
        if (!job) continue;
        user.invitation = {
          status: job.status === 'pending' || job.status === 'sending' ? 'queued' : job.status,
          deliveryState: deliveryStateOf(job.status),
          sentTo: maskEmail(user.email),
          simulated,
          error: job.lastError,
          at: job.sentAt ?? job.updatedAt,
        };
      }
    }
    return result;
  }

  async findOne(id: string): Promise<PublicUser> {
    return toPublicUser(await this.findEntityOrFail(id));
  }

  /**
   * Rol y estado actuales, leidos en cada peticion autenticada.
   * Devuelve null si el usuario ya no existe.
   */
  async findAuthContext(id: string): Promise<AuthContext | null> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!user || !user.role) return null;
    return { id: user.id, email: user.email, role: user.role.name, status: user.status };
  }

  async update(id: string, params: UpdateUserParams, actorUserId?: string): Promise<PublicUser> {
    const user = await this.findEntityOrFail(id);

    if (params.email && params.email.toLowerCase().trim() !== user.email) {
      const email = params.email.toLowerCase().trim();
      await this.assertEmailAvailable(email);
      user.email = email;
    }
    if (params.firstName !== undefined) user.firstName = params.firstName;
    if (params.lastName !== undefined) user.lastName = params.lastName;
    if (params.status !== undefined) user.status = params.status;
    const antes = { semester: user.semester, universityCode: user.universityCode };
    if (params.role !== undefined && params.role !== user.role.name) {
      const role = await this.rolesService.findByName(params.role);
      user.roleId = role.id;
      user.role = role;
      // Los semestres habilitados solo aplican al rol docente.
      if (params.role !== RolNombre.TEACHER) {
        await this.semesterAccess.delete({ teacherId: user.id });
      }
    }
    const rol = user.role.name;

    // El código se puede corregir, nunca dejar vacío, y debe llevar el prefijo
    // del rol: si el rol cambia, el código anterior deja de servir.
    const codigoNoEncaja = universityCodeProblem(user.universityCode, rol) !== null;
    if (params.universityCode !== undefined || codigoNoEncaja) {
      const codigo = this.assertUniversityCodeFormat(params.universityCode ?? user.universityCode, rol);
      if (codigo !== user.universityCode) await this.assertUniversityCodeAvailable(codigo, user.id);
      user.universityCode = codigo;
    }

    // Semestre: solo en los roles que lo cursan, y obligatorio en ellos.
    if (SEMESTER_ROLES.includes(rol)) {
      if (params.semester !== undefined) user.semester = params.semester;
      if (!user.semester) {
        throw new BadRequestException({
          message: 'Indique el semestre.',
          fields: { semester: ['Indique el semestre que cursa (1 a 8).'] },
        });
      }
    } else {
      user.semester = null;
    }

    const saved = await this.usersRepository.save(user);

    // El perfil del estudiante guarda una copia de su semestre y su código.
    if (rol === RolNombre.STUDENT) {
      const perfiles = this.dataSource.getRepository(StudentProfile);
      const perfil = (await perfiles.findOne({ where: { userId: saved.id } })) ?? perfiles.create({ userId: saved.id });
      if (perfil.semester !== saved.semester || perfil.universityCode !== saved.universityCode) {
        perfil.semester = saved.semester;
        perfil.universityCode = saved.universityCode;
        await perfiles.save(perfil);
      }
    }

    // Cambiar el semestre mueve a la persona dentro o fuera del alcance de un
    // docente: queda registrado quién lo hizo, igual que el código.
    if (antes.semester !== saved.semester || antes.universityCode !== saved.universityCode) {
      await this.audit.record({
        actorUserId: actorUserId ?? null,
        eventType: AuditEventType.INSTITUTIONAL_DATA_CHANGED,
        entityType: 'user',
        entityId: saved.id,
        metadata: { antes, despues: { semester: saved.semester, universityCode: saved.universityCode } },
      });
    }
    return toPublicUser(saved);
  }

  /**
   * Cambia el estado de una cuenta (§9.3).
   *
   * Retirar el acceso revoca las sesiones abiertas: si no, el usuario
   * suspendido seguiria operando hasta que caducara su JWT, que es
   * exactamente lo que la suspension pretende impedir.
   *
   * Reactivar una cuenta que nunca se activo la devuelve a
   * PENDING_ACTIVATION, no a ACTIVE: su titular aun no fijo contrasena.
   */
  async setStatus(
    id: string,
    status: UserStatus,
    actorUserId: string | null,
  ): Promise<PublicUser> {
    const user = await this.findEntityOrFail(id);
    const previous = user.status;

    if (status === UserStatus.ACTIVE && previous === UserStatus.PENDING_ACTIVATION) {
      throw new BadRequestException(
        'La cuenta aún no fue activada por su titular. Reenvíe el enlace de activación.',
      );
    }

    user.status = status;
    const saved = await this.usersRepository.save(user);

    if (status !== UserStatus.ACTIVE) {
      await this.sessions.revokeAllForUser(id);
      await this.accountTokens.revokeAll(id);
    }

    await this.audit.record({
      actorUserId,
      eventType: AuditEventType.USER_STATUS_CHANGED,
      entityType: 'user',
      entityId: id,
      metadata: { from: previous, to: status },
    });

    return toPublicUser(saved);
  }

  /**
   * Reenvía la invitación de una cuenta provisionada.
   *
   * Lo usa el administrador cuando el correo original no llegó. Respeta la
   * misma espera y el mismo tope diario que el reenvío público: si no, el
   * botón del administrador sería la vía para inundar un buzón —y para que
   * Outlook marque a Afinia como spam—. Al administrador sí se le dice cuánto
   * falta: él ya sabe que la cuenta existe.
   */
  async resendActivation(
    id: string,
    actorUserId: string | null,
  ): Promise<{ message: string; invitation: InvitationView }> {
    const user = await this.findEntityOrFail(id);
    if (user.status !== UserStatus.PENDING_ACTIVATION) {
      throw new BadRequestException('Esta cuenta ya está activada.');
    }

    const puede = await this.accountMail.check(user.id, 'account_activation');
    if (!puede.allowed) {
      const mensaje =
        puede.reason === 'already_queued'
          ? 'Ya hay un envío en curso para esta cuenta. Espere unos segundos y actualice la lista.'
          : puede.reason === 'daily_limit'
            ? 'Esta cuenta ya recibió el máximo de invitaciones de hoy. Así se evita que el '
              + 'proveedor marque los correos de Afinia como spam. Inténtelo mañana.'
            : `Se envió una invitación hace muy poco. Podrá reenviarla en ${puede.retryAfterSeconds} s.`;
      throw new HttpException(
        { message: mensaje, retryAfterSeconds: puede.retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const jobId = await this.activation.queueActivation(user, actorUserId);
    await this.audit.record({
      actorUserId,
      eventType: AuditEventType.ACTIVATION_REQUESTED,
      entityType: 'user',
      entityId: id,
      metadata: { via: 'admin' },
    });
    const invitation = await this.invitationOutcome(jobId, user.email);
    const message =
      invitation.status === 'failed'
        ? `No se pudo enviar la invitación: ${invitation.error ?? 'error del servidor de correo'}`
        : invitation.simulated
          ? 'Invitación generada en modo simulado: no salió a ningún buzón (ver docs/CORREO_REAL.md).'
          : `Invitación enviada a ${invitation.sentTo}.`;
    return { message, invitation };
  }

  /**
   * Da de baja una cuenta (§85).
   *
   * §85 lo dice sin rodeos: *preferir `status = INACTIVE` sobre hard delete*.
   * La razon se ve mirando la base: de `student_profiles` cuelgan veintiocho
   * tablas en cascada —afinidad, proyectos, evidencias, contribuciones, puntos,
   * equipos—. Borrar una cuenta no es quitar a alguien de una lista: es destruir
   * su historial academico completo, y ademas el de los proyectos en los que
   * colaboro con otros.
   *
   * Dar de baja cierra el acceso, que es lo que se persigue el 99 % de las
   * veces, y deja la historia intacta.
   */
  async deactivate(id: string, actorId: string): Promise<PublicUser> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${id}`);
    }
    if (user.status === UserStatus.INACTIVE) {
      return toPublicUser(user);
    }

    user.status = UserStatus.INACTIVE;
    await this.usersRepository.save(user);

    // Cerrar las sesiones abiertas es parte de dar de baja: sin esto, el token
    // de acceso vigente sigue funcionando hasta que caduque.
    const revocadas = await this.sessions.revokeAllForUser(id);
    await this.audit.record({
      eventType: AuditEventType.USER_STATUS_CHANGED,
      actorUserId: actorId,
      entityType: 'user',
      entityId: id,
      metadata: { to: UserStatus.INACTIVE, sessionsRevoked: revocadas },
    });

    return toPublicUser(user);
  }

  /**
   * Borra una cuenta de verdad (§85).
   *
   * Solo para cuentas sin historial: §85 lo reserva a *datos de prueba o
   * cuentas sin historial bajo reglas controladas*. Si la cuenta tiene perfil
   * estudiantil, se niega y explica que lo que corresponde es darla de baja.
   *
   * No se comprueba «tiene historial» contando filas por todas las tablas: la
   * existencia del perfil es la condicion suficiente, porque es de el de donde
   * cuelga todo lo demas.
   */
  async remove(id: string, actorId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${id}`);
    }

    const tienePerfil = await this.usersRepository.manager
      .getRepository(StudentProfile)
      .exists({ where: { userId: id } });
    if (tienePerfil) {
      throw new ConflictException(
        'Esta cuenta tiene historial académico y no puede eliminarse. '
        + 'Dé de baja al usuario: conserva su trayectoria y cierra su acceso.',
      );
    }

    await this.sessions.revokeAllForUser(id);
    await this.audit.record({
      eventType: AuditEventType.USER_STATUS_CHANGED,
      actorUserId: actorId,
      entityType: 'user',
      entityId: id,
      metadata: { hardDeleted: true, email: user.email, role: user.roleId },
    });
    await this.usersRepository.delete(id);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: { role: true },
    });
  }

  // ---------------------------------------------------------------------
  // Semestres habilitados para el docente (RF3)
  // ---------------------------------------------------------------------

  /** Semestres que un docente tiene habilitados, ordenados. */
  async getTeacherSemesters(teacherId: string): Promise<number[]> {
    const rows = await this.semesterAccess.find({
      where: { teacherId },
      order: { semester: 'ASC' },
    });
    return rows.map((r) => r.semester);
  }

  /** Igual que el anterior, en lote, para no consultar dentro de un bucle. */
  async getSemestersForTeachers(teacherIds: string[]): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    if (teacherIds.length === 0) return map;
    const rows = await this.semesterAccess.find({
      where: { teacherId: In(teacherIds) },
      order: { semester: 'ASC' },
    });
    for (const row of rows) {
      const list = map.get(row.teacherId) ?? [];
      list.push(row.semester);
      map.set(row.teacherId, list);
    }
    return map;
  }

  /** Reemplaza el conjunto completo de semestres habilitados de un docente. */
  async setTeacherSemesters(
    teacherId: string,
    semesters: number[],
    grantedById: string,
  ): Promise<number[]> {
    const teacher = await this.findEntityOrFail(teacherId);
    if (teacher.role.name !== RolNombre.TEACHER) {
      throw new BadRequestException(
        'Los semestres habilitados solo aplican a usuarios con rol docente.',
      );
    }
    const unique = [...new Set(semesters)].sort((a, b) => a - b);
    await this.semesterAccess.delete({ teacherId });
    if (unique.length > 0) {
      await this.semesterAccess.save(
        unique.map((semester) =>
          this.semesterAccess.create({ teacherId, semester, grantedById }),
        ),
      );
    }
    return unique;
  }

  private async findEntityOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${id}`);
    }
    return user;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('El correo ya está registrado.');
    }
  }
}
