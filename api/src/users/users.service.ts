import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RolNombre, UserStatus } from '@perfil/shared';
import { User } from '../entities/user.entity';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { RolesService } from '../roles/roles.service';
import { PublicUser, toPublicUser } from './types/public-user';

interface CreateUserParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: RolNombre;
  status?: UserStatus;
}

interface UpdateUserParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: RolNombre;
  status?: UserStatus;
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
  ) {}

  async create(params: CreateUserParams): Promise<PublicUser> {
    const email = params.email.toLowerCase().trim();
    await this.assertEmailAvailable(email);

    const role = await this.rolesService.findByName(params.role);
    const passwordHash = await bcrypt.hash(params.password, 10);

    const user = this.usersRepository.create({
      firstName: params.firstName,
      lastName: params.lastName,
      email,
      passwordHash,
      roleId: role.id,
      status: params.status ?? UserStatus.ACTIVE,
    });
    const saved = await this.usersRepository.save(user);
    saved.role = role;
    return toPublicUser(saved);
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

  async update(id: string, params: UpdateUserParams): Promise<PublicUser> {
    const user = await this.findEntityOrFail(id);

    if (params.email && params.email.toLowerCase().trim() !== user.email) {
      const email = params.email.toLowerCase().trim();
      await this.assertEmailAvailable(email);
      user.email = email;
    }
    if (params.firstName !== undefined) user.firstName = params.firstName;
    if (params.lastName !== undefined) user.lastName = params.lastName;
    if (params.status !== undefined) user.status = params.status;
    if (params.role !== undefined && params.role !== user.role.name) {
      const role = await this.rolesService.findByName(params.role);
      user.roleId = role.id;
      user.role = role;
      // Los semestres habilitados solo aplican al rol docente.
      if (params.role !== RolNombre.TEACHER) {
        await this.semesterAccess.delete({ teacherId: user.id });
      }
    }

    const saved = await this.usersRepository.save(user);
    return toPublicUser(saved);
  }

  async setActive(id: string, active: boolean): Promise<PublicUser> {
    const user = await this.findEntityOrFail(id);
    user.status = active ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    return toPublicUser(await this.usersRepository.save(user));
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Usuario no encontrado: ${id}`);
    }
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
