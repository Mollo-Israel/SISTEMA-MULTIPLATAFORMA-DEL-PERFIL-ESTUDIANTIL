import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { cleanLine, CODE_MSG, CODE_RE, IsSkillName, trimLower } from '../../common/validation';

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
}
