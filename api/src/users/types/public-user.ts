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
  /** Semestre que cursa, en los roles que lo indican. */
  semester?: number | null;
  /** Semestres adicionales por arrastre o repetición (V3 §8.1). Solo estudiantes. */
  academicScopeSemesters?: number[];
  /** Código universitario (`PREFIJO-XXXXXXX`). Toda cuenta lo tiene. */
  universityCode?: string | null;
  /**
   * Cómo quedó el último correo de cuenta: enviado, en cola o fallido, y por
   * qué. Nunca incluye el enlace ni el código: esos solo viajan al buzón del
   * titular.
   */
  invitation?: InvitationView;
}

/**
 * Estado mínimo del intento de envío que pide la V2 (§19). `SENT_TO_SMTP`
 * significa que el servidor de correo lo aceptó, no que llegó al buzón: Afinia
 * no puede saber eso, y no debe afirmarlo.
 */
export type DeliveryState = 'QUEUED' | 'SENT_TO_SMTP' | 'FAILED';

export function deliveryStateOf(status: string): DeliveryState {
  if (status === 'sent') return 'SENT_TO_SMTP';
  if (status === 'failed' || status === 'skipped') return 'FAILED';
  return 'QUEUED';
}

export interface InvitationView {
  status: 'sent' | 'queued' | 'failed' | 'skipped';
  deliveryState: DeliveryState;
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
    universityCode: user.universityCode ?? null,
    semester: user.semester ?? null,
    academicScopeSemesters: user.academicScopeSemesters ?? [],
    status: user.status,
    role: user.role.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
