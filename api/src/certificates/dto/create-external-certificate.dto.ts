import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { trim } from '../../common/validation';

export class CreateExternalCertificateDto {
  @ApiProperty({ example: 'Certified JavaScript Developer' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del certificado es obligatorio.' })
  @MaxLength(200, { message: 'El nombre no puede superar 200 caracteres.' })
  certificateName: string;

  @ApiProperty({ example: 'Plataforma Externa', description: 'Entidad emisora (externa al sistema)' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La entidad emisora es obligatoria.' })
  @MaxLength(160, { message: 'La entidad emisora no puede superar 160 caracteres.' })
  issuer: string;

  @ApiProperty({ required: false, example: 'https://emisor.example.com/cert/123' })
  @IsOptional()
  @Transform(trim)
  @IsUrl({}, { message: 'El enlace del certificado debe ser una URL válida.' })
  @MaxLength(500)
  certificateUrl?: string;

  @ApiProperty({ required: false, example: '2026-01-15' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de emisión no es válida.' })
  issueDate?: string;
}
