import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 6, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  semester?: number;

  @ApiProperty({ required: false, example: 'Enfocado en backend y bases de datos.' })
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
