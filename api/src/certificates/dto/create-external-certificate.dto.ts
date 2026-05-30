import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateExternalCertificateDto {
  @ApiProperty({ example: 'Certified JavaScript Developer' })
  @IsString()
  @MaxLength(200)
  certificateName: string;

  @ApiProperty({ example: 'Plataforma Externa', description: 'Entidad emisora (externa al sistema)' })
  @IsString()
  @MaxLength(160)
  issuer: string;

  @ApiProperty({ required: false, example: 'https://emisor.example.com/cert/123' })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  certificateUrl?: string;

  @ApiProperty({ required: false, example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  issueDate?: string;
}
