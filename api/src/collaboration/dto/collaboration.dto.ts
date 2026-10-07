import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsBoolean, ValidateNested } from 'class-validator';
import {
  AvailabilityRequirement,
  CONTACT_ALIAS_MAX,
  CONTACT_CONTEXT_MAX,
  ContactChannelType,
  ContactSource,
  TEAM_APPLICATION_REJECTION_REASONS,
  TeamApplicationRejectionReason,
  TeamNeedStatus,
} from '@perfil/shared';

const limpiar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

/** Solicitud de contacto (§45). Se identifica al destinatario por su slug. */
export class CreateContactRequestDto {
  @ApiProperty({ example: 'cdwxx59caf76' })
  @IsString()
  @Matches(/^[23456789bcdfghjkmnpqrstvwxyz]{6,24}$/, {
    message: 'El identificador del perfil no es válido.',
  })
  slug: string;

  @ApiProperty({ required: false, example: 'Nos conocimos en el taller de redes.' })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(300, { message: 'La presentación no puede superar 300 caracteres.' })
  message?: string;

  @ApiProperty({ enum: ContactSource, required: false })
  @IsOptional()
  @IsEnum(ContactSource, { message: 'Origen de contacto no válido.' })
  source?: ContactSource;
}

export class DecideContactRequestDto {
  @ApiProperty({ enum: ['accept', 'reject'] })
  @IsIn(['accept', 'reject'], { message: 'La decisión debe ser accept o reject.' })
  decision: 'accept' | 'reject';
}

/** Necesidad de equipo (§46). */
export class CreateTeamNeedDto {
  @ApiProperty({ example: 'Buscamos quien arme el panel de control' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'Indique para qué busca integrantes.' })
  @MaxLength(300, { message: 'El objetivo no puede superar 300 caracteres.' })
  purpose: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  activityId?: string;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional()
  @IsInt({ message: 'El máximo de integrantes debe ser un número.' })
  @Min(2, { message: 'Un equipo tiene al menos 2 integrantes.' })
  @Max(20, { message: 'Un equipo no puede superar 20 integrantes.' })
  maxMembers?: number;

  @ApiProperty({ enum: AvailabilityRequirement, required: false })
  @IsOptional()
  @IsEnum(AvailabilityRequirement, { message: 'Requisito de disponibilidad no válido.' })
  availabilityRequirement?: AvailabilityRequirement;

  /** §46, `required_skills[]`. Es lo que falta, no lo que el equipo ya tiene. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15, { message: 'Máximo 15 habilidades por necesidad.' })
  @ArrayUnique({ message: 'No repita habilidades.' })
  @IsUUID('4', { each: true })
  requiredSkillIds?: string[];

  /** §46, `preferred_areas[]`. */
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8, { message: 'Máximo 8 áreas por necesidad.' })
  @ArrayUnique({ message: 'No repita áreas.' })
  @IsUUID('4', { each: true })
  preferredAreaIds?: string[];

  /** V3 §55: semestres objetivo. Vacío = cualquiera. */
  @ApiProperty({ required: false, type: [Number], example: [5, 6] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique({ message: 'No repita semestres.' })
  @IsInt({ each: true, message: 'Cada semestre debe ser un número.' })
  @Min(1, { each: true, message: 'El semestre mínimo es 1.' })
  @Max(12, { each: true, message: 'El semestre máximo es 12.' })
  targetSemesters?: number[];
}

export class UpdateTeamNeedDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'El objetivo no puede quedar vacío.' })
  @MaxLength(300)
  purpose?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(20)
  maxMembers?: number;

  @ApiProperty({ enum: AvailabilityRequirement, required: false })
  @IsOptional()
  @IsEnum(AvailabilityRequirement)
  availabilityRequirement?: AvailabilityRequirement;

  @ApiProperty({ enum: TeamNeedStatus, required: false })
  @IsOptional()
  @IsEnum(TeamNeedStatus, { message: 'Estado de necesidad no válido.' })
  status?: TeamNeedStatus;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  requiredSkillIds?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  preferredAreaIds?: string[];

  /** V3 §55: semestres objetivo. Vacío = cualquiera. */
  @ApiProperty({ required: false, type: [Number], example: [5, 6] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique({ message: 'No repita semestres.' })
  @IsInt({ each: true, message: 'Cada semestre debe ser un número.' })
  @Min(1, { each: true, message: 'El semestre mínimo es 1.' })
  @Max(12, { each: true, message: 'El semestre máximo es 12.' })
  targetSemesters?: number[];
}

/** V3 §55: postular a una necesidad, con una presentación breve opcional. */
export class ApplyToTeamNeedDto {
  @ApiProperty({ required: false, example: 'Hice el backend de dos proyectos con NestJS.' })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(300, { message: 'La presentación no puede superar 300 caracteres.' })
  message?: string;
}

/** V3 §55: aceptar, o rechazar con un motivo predefinido y comentario breve. */
export class DecideTeamApplicationDto {
  @ApiProperty({ enum: ['accept', 'reject'] })
  @IsIn(['accept', 'reject'], { message: 'La decisión debe ser accept o reject.' })
  decision: 'accept' | 'reject';

  @ApiProperty({ required: false, enum: TEAM_APPLICATION_REJECTION_REASONS.map((r) => r.code) })
  @IsOptional()
  @IsIn(TEAM_APPLICATION_REJECTION_REASONS.map((r) => r.code), { message: 'Motivo no válido.' })
  reason?: TeamApplicationRejectionReason;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(200, { message: 'El comentario no puede superar 200 caracteres.' })
  comment?: string;
}

export class CreateTeamDto {
  @ApiProperty({ example: 'Equipo del panel de control' })
  @Transform(limpiar)
  @IsString()
  @IsNotEmpty({ message: 'El equipo necesita un nombre.' })
  @MaxLength(160, { message: 'El nombre no puede superar 160 caracteres.' })
  name: string;
}

/** §47: invitar es un acto de una persona, nunca del motor. */
export class InviteToTeamDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Seleccione a un estudiante.' })
  invitedProfileId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(300, { message: 'El mensaje no puede superar 300 caracteres.' })
  message?: string;
}

export class DecideTeamInvitationDto {
  @ApiProperty({ enum: ['accept', 'decline'] })
  @IsIn(['accept', 'decline'], { message: 'La decisión debe ser accept o decline.' })
  decision: 'accept' | 'decline';
}

/** Un canal de contacto (V2 §59). El formato lo valida el servicio por canal. */
export class ContactChannelDto {
  @ApiProperty({ enum: ContactChannelType })
  @IsEnum(ContactChannelType, { message: 'Canal no válido.' })
  channel: ContactChannelType;

  @ApiProperty({ example: '+591 71234567' })
  @IsString()
  @MaxLength(300)
  value: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class SaveContactChannelsDto {
  @ApiProperty({ type: [ContactChannelDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ContactChannelDto)
  channels: ContactChannelDto[];
}

/** Nota personal sobre un contacto (V2 §56). */
export class ContactNoteDto {
  @ApiProperty({ required: false, maxLength: CONTACT_ALIAS_MAX })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(CONTACT_ALIAS_MAX, { message: `El alias no puede superar ${CONTACT_ALIAS_MAX} caracteres.` })
  alias?: string | null;

  @ApiProperty({ required: false, maxLength: CONTACT_CONTEXT_MAX })
  @IsOptional()
  @Transform(limpiar)
  @IsString()
  @MaxLength(CONTACT_CONTEXT_MAX, { message: `El contexto no puede superar ${CONTACT_CONTEXT_MAX} caracteres.` })
  context?: string | null;

  @ApiProperty({ required: false, enum: ContactChannelType, nullable: true })
  @IsOptional()
  @IsEnum(ContactChannelType, { message: 'Canal no válido.' })
  preferredChannel?: ContactChannelType | null;
}
