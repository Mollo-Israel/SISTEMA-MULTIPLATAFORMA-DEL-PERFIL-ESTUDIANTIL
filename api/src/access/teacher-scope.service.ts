import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

/**
 * Semestres que cuentan para el alcance docente de un estudiante (V3 §8.1): el
 * actual y los de arrastre o repetición.
 */
export function effectiveSemesters(profile: {
  semester: number | null;
  academicScopeSemesters?: number[] | null;
}): number[] {
  const todos = [profile.semester, ...(profile.academicScopeSemesters ?? [])];
  return [...new Set(todos.filter((s): s is number => typeof s === 'number'))];
}

/** ¿El estudiante entra en alguno de estos semestres habilitados? */
export function inTeacherScope(
  profile: { semester: number | null; academicScopeSemesters?: number[] | null },
  allowed: number[],
): boolean {
  return effectiveSemesters(profile).some((s) => allowed.includes(s));
}

/**
 * La misma regla en SQL, para los listados: el semestre actual **o** uno de
 * arrastre está en el alcance. `param` es el nombre del parámetro con la lista
 * de semestres; el alias apunta a `student_profiles`.
 */
export function scopeSql(alias: string, param = 'scope'): string {
  return `(${alias}.semester IN (:...${param}) OR ${alias}.academic_scope_semesters && ARRAY[:...${param}]::smallint[])`;
}

/**
 * Alcance de consulta del docente sobre perfiles de estudiantes (RF3 + privacidad
 * del Objetivo 2).
 *
 * Un docente solo accede a los perfiles de los semestres que el administrador le
 * habilito. El director de carrera y el administrador ven la cohorte completa,
 * porque su funcion es justamente la vista agregada de la carrera.
 *
 * Se centraliza aqui para que perfiles, afinidad y constancias apliquen
 * exactamente la misma regla.
 */
@Injectable()
export class TeacherScopeService {
  constructor(
    @InjectRepository(TeacherSemesterAccess)
    private readonly access: Repository<TeacherSemesterAccess>,
    @InjectRepository(StudentProfile)
    private readonly profiles: Repository<StudentProfile>,
  ) {}

  /** true cuando el rol ve la cohorte completa sin restriccion por semestre. */
  isUnrestricted(role: RolNombre): boolean {
    return role === RolNombre.CAREER_DIRECTOR || role === RolNombre.ADMIN;
  }

  /** Semestres habilitados de un docente, ordenados. */
  async allowedSemesters(teacherId: string): Promise<number[]> {
    const rows = await this.access.find({
      where: { teacherId },
      order: { semester: 'ASC' },
    });
    return rows.map((r) => r.semester);
  }

  /**
   * Semestres que el usuario puede consultar.
   * `null` significa "sin restriccion" (director y administrador).
   */
  async scopeFor(user: AuthenticatedUser): Promise<number[] | null> {
    if (this.isUnrestricted(user.role)) return null;
    if (user.role === RolNombre.TEACHER) return this.allowedSemesters(user.userId);
    return [];
  }

  /**
   * Verifica que el usuario pueda consultar el perfil indicado y lo devuelve.
   * Un perfil sin semestre declarado no entra en el alcance de ningun docente:
   * no hay forma de ubicarlo en un semestre habilitado.
   */
  async assertCanAccessProfile(
    user: AuthenticatedUser,
    studentProfileId: string,
  ): Promise<StudentProfile> {
    const profile = await this.profiles.findOne({
      where: { id: studentProfileId },
      relations: { user: true },
    });
    if (!profile) {
      throw new NotFoundException('Perfil no encontrado.');
    }
    if (this.isUnrestricted(user.role)) return profile;

    if (user.role !== RolNombre.TEACHER) {
      throw new ForbiddenException('Su rol no puede consultar perfiles de estudiantes.');
    }

    const semesters = await this.allowedSemesters(user.userId);
    if (semesters.length === 0) {
      throw new ForbiddenException(
        'No tiene semestres habilitados. Solicite al administrador que le asigne los semestres que debe acompañar.',
      );
    }
    if (!inTeacherScope(profile, semesters)) {
      throw new ForbiddenException(
        'Este estudiante no pertenece a los semestres que tiene habilitados.',
      );
    }
    return profile;
  }
}
