import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GamificationTrigger } from '@perfil/shared';
import { cleanLine, cleanText } from '../../common/validation';

/**
 * Alta de un criterio de gamificacion (RF4). En el 40% el criterio se almacena
 * y administra, pero ningun modulo lo consume todavia.
 */
export class CreateGamificationCriterionDto {
  @ApiProperty({ example: 'participacion_taller' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio.' })
  @MinLength(3, { message: 'El código debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El código no puede superar 60 caracteres.' })
  @Matches(/^[a-z0-9_]+$/, {
    message: 'El código solo admite minúsculas, números y guion bajo.',
  })
  code: string;

  @ApiProperty({ example: 'Participación confirmada en taller' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La descripción no puede superar 300 caracteres.' })
  description?: string;

  @ApiProperty({ enum: GamificationTrigger })
  @IsEnum(GamificationTrigger, { message: 'El hecho que otorga el criterio no es válido.' })
  trigger: GamificationTrigger;

  @ApiProperty({ example: 10, minimum: 0, maximum: 1000 })
  @IsInt({ message: 'Los puntos deben ser un número entero.' })
  @Min(0, { message: 'Los puntos no pueden ser negativos.' })
  @Max(1000, { message: 'El máximo es 1000 puntos.' })
  points: number;

  @ApiProperty({ required: false, description: 'Limitar el criterio a un área académica' })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGamificationCriterionDto extends PartialType(
  CreateGamificationCriterionDto,
) {}
