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
import {
  AvailabilityRequirement,
  ContactSource,
  MESSAGE_MAX_LENGTH,
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

export class OpenDirectConversationDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Seleccione a un contacto.' })
  profileId: string;
}

export class SendMessageDto {
  @ApiProperty({ maxLength: MESSAGE_MAX_LENGTH })
  @IsString()
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío.' })
  @MaxLength(MESSAGE_MAX_LENGTH, {
    message: `El mensaje no puede superar ${MESSAGE_MAX_LENGTH} caracteres.`,
  })
  body: string;
}
