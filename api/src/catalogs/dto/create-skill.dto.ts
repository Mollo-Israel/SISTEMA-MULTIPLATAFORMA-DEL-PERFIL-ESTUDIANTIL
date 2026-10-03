import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { cleanLine, CODE_MSG, CODE_RE, IsSkillName, trimLower } from '../../common/validation';

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
}
