import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolNombre } from '@perfil/shared';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

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
    if (profile.semester === null || !semesters.includes(profile.semester)) {
      throw new ForbiddenException(
        'Este estudiante no pertenece a los semestres que tiene habilitados.',
      );
    }
    return profile;
  }
}
