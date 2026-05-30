import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class InterestItemDto {
  @ApiProperty({ description: 'ID del área académica' })
  @IsUUID('4')
  academicAreaId: string;

  @ApiProperty({ example: 3, minimum: 1, maximum: 5, description: 'Prioridad / nivel de interés' })
  @IsInt()
  @Min(1)
  @Max(5)
  priority: number;
}

export class SetInterestsDto {
  @ApiProperty({ type: [InterestItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items: InterestItemDto[];
}

export class ReplaceInterestsDto {
  @ApiProperty({ type: [InterestItemDto], description: 'Reemplaza el conjunto completo (puede ir vacío)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items: InterestItemDto[];
}
