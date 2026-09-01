import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ActivityType } from '@perfil/shared';
import { cleanLine, cleanText } from '../../common/validation';

/**
 * Alta de una categoria de actividad (RF4).
 * El administrador la gestiona igual que las areas academicas y las habilidades.
 */
export class CreateActivityCategoryDto {
  @ApiProperty({ example: 'mesa_redonda', description: 'Identificador estable, en minúsculas' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio.' })
  @MinLength(3, { message: 'El código debe tener al menos 3 caracteres.' })
  @MaxLength(60, { message: 'El código no puede superar 60 caracteres.' })
  @Matches(/^[a-z0-9_]+$/, {
    message: 'El código solo admite minúsculas, números y guion bajo.',
  })
  code: string;

  @ApiProperty({ example: 'Mesa redonda' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name: string;

  @ApiProperty({ required: false, example: 'Debate abierto entre varios ponentes.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(255, { message: 'La descripción no puede superar 255 caracteres.' })
  description?: string;

  @ApiProperty({
    required: false,
    enum: ActivityType,
    description: 'Tipo al que aplica. Sin valor, la categoría sirve para ambos tipos.',
  })
  @IsOptional()
  @IsEnum(ActivityType, { message: 'El tipo de actividad no es válido.' })
  appliesTo?: ActivityType;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateActivityCategoryDto extends PartialType(CreateActivityCategoryDto) {}
