import { RolNombre, UserStatus } from '@perfil/shared';
import { User } from '../../entities/user.entity';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  role: RolNombre;
  createdAt: Date;
  updatedAt: Date;
  /** Semestres habilitados. Solo se completa para usuarios con rol docente. */
  semesters?: number[];
  /** Semestre institucional. Solo para estudiantes. */
  semester?: number | null;
  /** Código universitario. Solo para estudiantes. */
  universityCode?: string | null;
  /**
   * Cómo quedó el último correo de cuenta: enviado, en cola o fallido, y por
   * qué. Nunca incluye el enlace ni el código: esos solo viajan al buzón del
   * titular.
   */
  invitation?: InvitationView;
}

export interface InvitationView {
  status: 'sent' | 'queued' | 'failed' | 'skipped';
  /** Correo enmascarado al que se envió. */
  sentTo?: string;
  /** El correo no salió a ningún buzón: el sistema está en modo simulado. */
  simulated?: boolean;
  error?: string | null;
  at?: Date | null;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    role: user.role.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
