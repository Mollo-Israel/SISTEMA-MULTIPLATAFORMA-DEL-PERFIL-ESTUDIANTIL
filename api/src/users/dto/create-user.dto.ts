import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  RolNombre,
  SEMESTER_ROLES,
  UNIVERSITY_CODE_PATTERN,
  UserStatus,
  normalizeUniversityCode,
} from '@perfil/shared';
import { cleanLine, EMAIL_MSG, NAME_MSG, NAME_RE, PASSWORD_MSG, PASSWORD_RE, trimLower, UNIVALLE_RE } from '../../common/validation';

/**
 * Roles institucionales, los que no son estudiante.
 * Se conserva porque la interfaz distingue ambos grupos al editar un usuario.
 */
export const INSTITUTIONAL_ROLES = [
  RolNombre.TEACHER,
  RolNombre.CAREER_DIRECTOR,
  RolNombre.SCIENTIFIC_SOCIETY,
] as const;

/**
 * Roles que el administrador puede provisionar (RF01, §9.2).
 *
 * Incluye STUDENT: desde que no existe registro publico, tambien las cuentas
 * de estudiante nacen por importacion o alta administrativa. La de
 * administrador sigue creandose por seed, no por este endpoint: quien ya es
 * administrador no debe poder fabricar otro desde la interfaz ordinaria.
 */
export const PROVISIONABLE_ROLES = [
  RolNombre.STUDENT,
  RolNombre.TEACHER,
  RolNombre.CAREER_DIRECTOR,
  RolNombre.SCIENTIFIC_SOCIETY,
] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'Carlos' })
  @Transform(cleanLine)
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El nombre no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: `El nombre. ${NAME_MSG}` })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(cleanLine)
  @IsString()
  @MinLength(2, { message: 'El apellido debe tener al menos 2 caracteres.' })
  @MaxLength(50, { message: 'El apellido no puede superar 50 caracteres.' })
  @Matches(NAME_RE, { message: `El apellido. ${NAME_MSG}` })
  lastName: string;

  @ApiProperty({ example: 'carlos.perez@univalle.edu' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'El correo no tiene un formato válido.' })
  @MaxLength(160, { message: 'El correo es demasiado largo.' })
  @Matches(UNIVALLE_RE, { message: EMAIL_MSG })
  email: string;

  /**
   * Opcional a propósito (§12).
   *
   * La cuenta nace en `pending_activation` y su titular fija la contraseña al
   * activarla. Si se omite, el servidor guarda un hash aleatorio que nadie
   * conoce: es preferible a que el administrador elija una clave que luego
   * tendría que comunicar por un canal inseguro. Se acepta cuando se envía
   * porque el alta con estado `active` explícito sigue necesitándola.
   */
  @ApiProperty({ example: 'Clave123*', minLength: 8, required: false })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña es demasiado larga.' })
  @Matches(PASSWORD_RE, { message: PASSWORD_MSG })
  password?: string;

  @ApiProperty({
    enum: PROVISIONABLE_ROLES,
    example: RolNombre.STUDENT,
    description:
      'Estudiante, docente, director de carrera o sociedad científica. '
      + 'La cuenta de administrador no se crea desde aquí.',
  })
  @IsEnum(RolNombre)
  @IsIn(PROVISIONABLE_ROLES as unknown as RolNombre[], {
    message:
      'Rol no permitido. Puede provisionar estudiantes, docentes, dirección de carrera '
      + 'o sociedad científica.',
  })
  role: RolNombre;

  @ApiProperty({ enum: UserStatus, required: false, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /**
   * Semestre que cursa (§17.1), obligatorio en los roles que lo indican
   * (`SEMESTER_ROLES`). Es un dato que la persona no puede fijar: si no lo
   * pone quien crea la cuenta, nadie lo pone.
   */
  @ApiProperty({ required: false, minimum: 1, maximum: 8, example: 3 })
  @ValidateIf((o: CreateUserDto) => SEMESTER_ROLES.includes(o.role) || o.semester !== undefined)
  @Type(() => Number)
  @IsIn([1, 2, 3, 4, 5, 6, 7, 8], { message: 'Indique el semestre que cursa (1 a 8).' })
  semester?: number;

  /**
   * Código universitario (V2 §12): obligatorio y único en toda cuenta, con el
   * formato `PREFIJO-XXXXXXX`. El prefijo depende del rol (EST, DOC, DIR o
   * ADM); esa correspondencia la comprueba el servicio.
   */
  @ApiProperty({ example: 'EST-38DJ1HA', description: 'PREFIJO-XXXXXXX: EST, DOC, DIR o ADM según el rol.' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeUniversityCode(value) : value))
  @IsString({ message: 'El código universitario es obligatorio.' })
  @IsNotEmpty({ message: 'El código universitario es obligatorio.' })
  @Matches(UNIVERSITY_CODE_PATTERN, {
    message: 'Formato del código: tres letras, guion y 7 letras o números (por ejemplo EST-38DJ1HA).',
  })
  universityCode: string;
}
