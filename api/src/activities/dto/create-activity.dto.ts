import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ActivityCategory,
  ActivityModality,
  ActivityStatus,
  ActivityType,
} from '@perfil/shared';

export class CreateActivityDto {
  @ApiProperty({ example: 'Taller de NestJS' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({ enum: ActivityCategory })
  @IsEnum(ActivityCategory)
  category: ActivityCategory;

  @ApiProperty({ enum: ActivityModality, required: false, default: ActivityModality.PRESENCIAL })
  @IsOptional()
  @IsEnum(ActivityModality)
  modality?: ActivityModality;

  @ApiProperty({ required: false, example: '2026-06-15T15:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  activityDate?: string;

  @ApiProperty({ required: false, example: 'Aula 301' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiProperty({ required: false, example: 30, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiProperty({ required: false, description: 'ID del área académica' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false, example: 'https://evento.example.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  externalUrl?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;

  @ApiProperty({
    enum: ActivityStatus,
    required: false,
    default: ActivityStatus.DRAFT,
    description: 'Estado inicial (por defecto draft)',
  })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;
}
