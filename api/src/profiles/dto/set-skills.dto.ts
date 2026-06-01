import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class SkillItemDto {
  @ApiProperty({ description: 'ID de la habilidad (catálogo)' })
  @IsUUID('4')
  skillId: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 5, description: 'Nivel declarado' })
  @IsInt({ message: 'El nivel debe ser un número.' })
  @Min(1, { message: 'El nivel mínimo es 1.' })
  @Max(5, { message: 'El nivel máximo es 5.' })
  level: number;
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
