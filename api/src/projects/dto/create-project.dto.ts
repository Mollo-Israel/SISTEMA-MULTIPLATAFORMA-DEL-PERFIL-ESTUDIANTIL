import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ProjectStatus } from '@perfil/shared';

export class CreateProjectDto {
  @ApiProperty({ example: 'Plataforma de tutorías' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, description: 'ID del área académica' })
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiProperty({ required: false, type: [String], example: ['React', 'Node.js'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];

  @ApiProperty({ enum: ProjectStatus, required: false, default: ProjectStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({ required: false, example: 'https://github.com/usuario/proyecto' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  repositoryUrl?: string;

  @ApiProperty({ required: false, example: 'https://demo.example.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  demoUrl?: string;
}
