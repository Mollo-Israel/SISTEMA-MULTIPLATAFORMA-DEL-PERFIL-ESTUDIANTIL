import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { cleanLine, CODE_MSG, CODE_RE, IsSkillName, SKILL_NAME_RE, trimLower } from '../../common/validation';

/**
 * Edición parcial de una habilidad.
 *
 * Se declara a mano en lugar de derivarla del alta: con un `PartialType`, el
 * área aceptaría `null` y una edición podría dejar la habilidad sin área, que
 * es justo lo que el alta ya no permite.
 */
export class UpdateSkillDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la habilidad no puede quedar vacío.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsSkillName()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @Matches(CODE_RE, { message: CODE_MSG })
  code?: string;

  @ApiProperty({ required: false, description: 'No admite null: la habilidad siempre tiene área.' })
  @ValidateIf((o: UpdateSkillDto) => o.academicAreaId !== undefined)
  @IsUUID('4', { message: 'Elija el área académica de la habilidad.' })
  academicAreaId?: string;

  @ApiProperty({
    required: false,
    description: 'Una habilidad inactiva deja de ofrecerse, pero conserva los registros existentes.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false, type: [String], example: ['ReactJS'], description: 'Otros nombres de la misma tecnología.' })
  @IsOptional()
  @IsArray({ message: 'Los alias deben ser una lista.' })
  @ArrayMaxSize(10, { message: 'Como máximo 10 alias.' })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => String(v).trim().replace(/\s+/g, ' ')).filter(Boolean) : value))
  @Matches(SKILL_NAME_RE, { each: true, message: 'Cada alias debe ser un nombre de tecnología válido (p. ej. «ReactJS», «C#»).' })
  @MaxLength(120, { each: true, message: 'Cada alias puede tener como máximo 120 caracteres.' })
  aliases?: string[];

  @ApiProperty({
    required: false,
    description: 'Motivo para guardar en un área distinta de la sugerida (queda auditado, V2 §23.3).',
  })
  @IsOptional()
  @Transform(cleanLine)
  @IsString()
  @MinLength(10, { message: 'Explica el motivo en al menos 10 caracteres.' })
  @MaxLength(300, { message: 'El motivo no puede superar 300 caracteres.' })
  overrideReason?: string;
}
