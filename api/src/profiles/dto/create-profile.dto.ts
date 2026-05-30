import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({ required: false, example: 'SIS-2021-001' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  universityCode?: string;

  @ApiProperty({ required: false, example: 5, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @ApiProperty({ required: false, example: 'Interesado en desarrollo web y datos.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiProperty({ required: false, type: [String], description: 'IDs de áreas académicas donde desea mejorar' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  improvementAreaIds?: string[];
}
