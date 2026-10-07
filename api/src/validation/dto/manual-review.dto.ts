import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ManualReviewStatus } from '@perfil/shared';
import { cleanText } from '../../common/validation';

/** El estudiante pide la revisión excepcional (V3 §16). */
export class RequestManualReviewDto {
  @ApiProperty({ required: false, example: 'El emisor confirma por correo a certificados@emisor.org.' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300, { message: 'La nota no puede superar 300 caracteres.' })
  note?: string;
}

/** Dirección decide la revisión excepcional (V3 §16, §19). */
export class DecideManualReviewDto {
  @ApiProperty({ enum: [ManualReviewStatus.CORROBORATED, ManualReviewStatus.NOT_CORROBORATED] })
  @IsIn([ManualReviewStatus.CORROBORATED, ManualReviewStatus.NOT_CORROBORATED], {
    message: 'La decisión es corroborar o no corroborar.',
  })
  decision: ManualReviewStatus.CORROBORATED | ManualReviewStatus.NOT_CORROBORATED;

  /** Obligatorio: cómo se comprobó. Queda en la auditoría. */
  @ApiProperty({ example: 'Consulté al emisor por correo y confirmó el código y el nombre.' })
  @Transform(cleanText)
  @IsString()
  @MinLength(20, { message: 'Explica cómo lo comprobaste (al menos 20 caracteres).' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres.' })
  reason: string;
}
