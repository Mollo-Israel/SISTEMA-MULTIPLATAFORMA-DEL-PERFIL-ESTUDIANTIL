import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ManualReviewMethod, ManualReviewStatus } from '@perfil/shared';
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

export const MANUAL_DECISIONS = [
  ManualReviewStatus.CORROBORATED,
  ManualReviewStatus.INCONCLUSIVE,
  ManualReviewStatus.REJECTED,
  // Anterior a V4.1: se registra como «inconclusa».
  ManualReviewStatus.NOT_CORROBORATED,
] as const;
export type ManualDecision = (typeof MANUAL_DECISIONS)[number];

/**
 * Dirección decide la revisión excepcional (V3 §16, §19; V4.1 A41-018).
 *
 * Verificar exige un método con prueba externa independiente del propio
 * archivo (B32); si solo se miró el documento, la decisión es «inconclusa».
 */
export class DecideManualReviewDto {
  @ApiProperty({ enum: MANUAL_DECISIONS })
  @IsIn(MANUAL_DECISIONS as unknown as string[], {
    message: 'La decisión es verificada con prueba externa, inconclusa o rechazada.',
  })
  decision: ManualDecision;

  @ApiProperty({ enum: ManualReviewMethod, required: false })
  @IsOptional()
  @IsIn(Object.values(ManualReviewMethod), { message: 'Indica cómo se comprobó.' })
  method?: ManualReviewMethod;

  /** URL o referencia de la prueba externa (correo del emisor, registro oficial…). */
  @ApiProperty({ required: false, example: 'https://verify.emisor.org/cert/AB-123' })
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(500, { message: 'La prueba no puede superar 500 caracteres.' })
  proof?: string;

  /** Obligatorio: cómo se comprobó. Queda en la auditoría. */
  @ApiProperty({ example: 'Consulté al emisor por correo y confirmó el código y el nombre.' })
  @Transform(cleanText)
  @IsString()
  @MinLength(20, { message: 'Explica cómo lo comprobaste (al menos 20 caracteres).' })
  @MaxLength(500, { message: 'El motivo no puede superar 500 caracteres.' })
  reason: string;
}
