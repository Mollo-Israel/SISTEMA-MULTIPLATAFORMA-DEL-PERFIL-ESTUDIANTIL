import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class InterestItemDto {
  @ApiProperty({ description: 'ID del área académica' })
  @IsUUID('4')
  academicAreaId: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 5, description: 'Prioridad / nivel de interés' })
  @IsInt({ message: 'La prioridad debe ser un número.' })
  @Min(1, { message: 'La prioridad mínima es 1.' })
  @Max(5, { message: 'La prioridad máxima es 5.' })
  priority: number;
}

export class SetInterestsDto {
  @ApiProperty({ type: [InterestItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debes indicar al menos un interés.' })
  @ArrayUnique((i: InterestItemDto) => i.academicAreaId, { message: 'No se permiten áreas de interés duplicadas.' })
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items: InterestItemDto[];
}

export class ReplaceInterestsDto {
  @ApiProperty({ type: [InterestItemDto], description: 'Reemplaza el conjunto completo (puede ir vacío)' })
  @IsArray()
  @ArrayUnique((i: InterestItemDto) => i.academicAreaId, { message: 'No se permiten áreas de interés duplicadas.' })
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items: InterestItemDto[];
}
