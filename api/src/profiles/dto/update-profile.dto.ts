import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AvailabilityStatus,
  CollaborationInterest,
  CollaborationMode,
} from '@perfil/shared';
import { cleanText } from '../../common/validation';

/** Preferencias de colaboración (§17.2). */
export class CollaborationPreferencesDto {
  @ApiProperty({ enum: CollaborationMode, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(CollaborationMode, { each: true, message: 'Modo de colaboración no válido.' })
  modes?: CollaborationMode[];

  @ApiProperty({ enum: CollaborationInterest, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsEnum(CollaborationInterest, { each: true, message: 'Tipo de colaboración no válido.' })
  interests?: CollaborationInterest[];

  @ApiProperty({ required: false, minimum: 1, maximum: 40 })
  @IsOptional()
  @IsInt({ message: 'Las horas por semana deben ser un número.' })
  @Min(1, { message: 'Indica al menos 1 hora por semana.' })
  @Max(40, { message: 'Como máximo 40 horas por semana.' })
  hoursPerWeek?: number;

  @ApiProperty({ required: false, maxLength: 300 })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La nota no puede superar 300 caracteres.' })
  notes?: string;
}

/**
 * Edición del perfil por su titular (§17.2).
 *
 * `semester` y `universityCode` no aparecen: §17.1 los declara institucionales
 * y no editables por el estudiante. Antes sí se podían cambiar aquí, lo que
 * permitía a cualquiera declararse de otro semestre y con ello entrar o salir
 * del alcance académico de un docente.
 */
export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'Enfocado en backend y bases de datos.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  bio?: string;

  @ApiProperty({ required: false, type: [String], description: 'IDs de áreas académicas donde desea mejorar' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Máximo 20 áreas a mejorar.' })
  @ArrayUnique({ message: 'No se permiten áreas duplicadas.' })
  @IsUUID('4', { each: true })
  improvementAreaIds?: string[];

  @ApiProperty({
    required: false,
    example: true,
    description: 'Aparecer como posible compañero de equipo en las recomendaciones de otros estudiantes',
  })
  @IsOptional()
  @IsBoolean({ message: 'La preferencia de aparecer en sugerencias debe ser verdadero o falso.' })
  peerDiscoverable?: boolean;

  @ApiProperty({ required: false, enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus, { message: 'Disponibilidad no válida.' })
  availability?: AvailabilityStatus;

  @ApiProperty({ required: false, type: CollaborationPreferencesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CollaborationPreferencesDto)
  collaborationPreferences?: CollaborationPreferencesDto;
}
