import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { SkillLevel } from '@perfil/shared';

export class SkillItemDto {
  @ApiProperty({ description: 'ID de la habilidad (catálogo)' })
  @IsUUID('4')
  skillId: string;

  /**
   * Autoevaluación en tres niveles (§21.1).
   *
   * Era una escala de 1 a 5. Se reduce a tres porque nadie sabe situarse
   * entre un 3 y un 4 de sí mismo, y la precisión extra solo servía para
   * dar una falsa sensación de medida.
   */
  @ApiProperty({
    enum: SkillLevel,
    example: SkillLevel.INTERMEDIATE,
    description: 'Nivel autodeclarado: basic, intermediate o advanced',
  })
  @IsEnum(SkillLevel, {
    message: 'El nivel debe ser basic, intermediate o advanced.',
  })
  level: SkillLevel;
}

export class SetSkillsDto {
  @ApiProperty({ type: [SkillItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debes indicar al menos una habilidad.' })
  @ArrayMaxSize(40, { message: 'Máximo 40 habilidades.' })
  @ArrayUnique((s: SkillItemDto) => s.skillId, { message: 'No se permiten habilidades duplicadas.' })
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  items: SkillItemDto[];
}

export class ReplaceSkillsDto {
  @ApiProperty({ type: [SkillItemDto], description: 'Reemplaza el conjunto completo (puede ir vacío)' })
  @IsArray()
  @ArrayMaxSize(40, { message: 'Máximo 40 habilidades.' })
  @ArrayUnique((s: SkillItemDto) => s.skillId, { message: 'No se permiten habilidades duplicadas.' })
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  items: SkillItemDto[];
}
