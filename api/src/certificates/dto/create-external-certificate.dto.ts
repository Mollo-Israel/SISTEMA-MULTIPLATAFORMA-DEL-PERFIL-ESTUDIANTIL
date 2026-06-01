import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { cleanLine, IsNotFutureDate, trim } from '../../common/validation';

export class CreateExternalCertificateDto {
  @ApiProperty({ example: 'Certified JavaScript Developer' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del certificado es obligatorio.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(200, { message: 'El nombre no puede superar 200 caracteres.' })
  certificateName: string;

  @ApiProperty({ example: 'Plataforma Externa', description: 'Entidad emisora (externa al sistema)' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'La entidad emisora es obligatoria.' })
  @MinLength(2, { message: 'La entidad emisora debe tener al menos 2 caracteres.' })
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
  @IsNotFutureDate({ message: 'La fecha de emisión no puede ser futura.' })
  issueDate?: string;
}
