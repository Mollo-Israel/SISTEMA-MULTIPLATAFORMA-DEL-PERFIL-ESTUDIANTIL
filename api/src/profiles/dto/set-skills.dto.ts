import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class SkillItemDto {
  @ApiProperty({ description: 'ID de la habilidad (catálogo)' })
  @IsUUID('4')
  skillId: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 5, description: 'Nivel declarado' })
  @IsInt()
  @Min(1)
  @Max(5)
  level: number;
}

export class SetSkillsDto {
  @ApiProperty({ type: [SkillItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  items: SkillItemDto[];
}

export class ReplaceSkillsDto {
  @ApiProperty({ type: [SkillItemDto], description: 'Reemplaza el conjunto completo (puede ir vacío)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SkillItemDto)
  items: SkillItemDto[];
}
