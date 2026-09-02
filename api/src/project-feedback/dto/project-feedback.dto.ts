import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { cleanText } from '../../common/validation';

/**
 * Retroalimentacion academica basica sobre un proyecto (RF16).
 *
 * ALCANCE (RN-13): es orientacion complementaria. El DTO no admite nota,
 * puntaje ni estado de aprobacion, y eso es deliberado: el documento excluye
 * expresamente que esto sea una evaluacion academica formal.
 */
export class CreateProjectFeedbackDto {
  @ApiProperty({
    example:
      'Buen avance en la capa de datos. Sugiero documentar el modelo entidad-relación y agregar pruebas al módulo de reportes.',
  })
  @Transform(cleanText)
  @IsString()
  @IsNotEmpty({ message: 'El comentario es obligatorio.' })
  @MinLength(10, { message: 'El comentario debe tener al menos 10 caracteres.' })
  @MaxLength(1000, { message: 'El comentario no puede superar 1000 caracteres.' })
  comment: string;
}

export class UpdateProjectFeedbackDto extends PartialType(CreateProjectFeedbackDto) {}
