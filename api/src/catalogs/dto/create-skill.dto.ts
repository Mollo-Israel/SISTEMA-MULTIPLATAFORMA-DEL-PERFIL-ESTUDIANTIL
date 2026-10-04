import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { cleanLine, CODE_MSG, CODE_RE, IsSkillName, SKILL_NAME_RE, trimLower } from '../../common/validation';

/**
 * Alta de una habilidad o tecnología.
 *
 * El área es obligatoria: es la que recibe el puntaje de la habilidad en el
 * motor (§21). Una habilidad sin área existe en el catálogo pero no cuenta
 * para nada, y quien la declara no lo sabe.
 */
export class CreateSkillDto {
  @ApiProperty({ example: 'GraphQL' })
  @Transform(cleanLine)
  @IsString({ message: 'El nombre de la habilidad es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre de la habilidad es obligatorio.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsSkillName()
  name: string;

  @ApiProperty({
    required: false,
    example: 'graphql',
    description: 'Si se omite, se genera a partir del nombre.',
  })
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @Matches(CODE_RE, { message: CODE_MSG })
  code?: string;

  @ApiProperty({ description: 'Área académica que recibe el puntaje de la habilidad.' })
  @IsUUID('4', { message: 'Elija el área académica de la habilidad.' })
  academicAreaId: string;

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
