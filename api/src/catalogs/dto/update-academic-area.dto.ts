import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAcademicAreaDto } from './create-academic-area.dto';

/**
 * Edición parcial de un área.
 *
 * Si se envían etiquetas, siguen haciendo falta al menos una: vaciarlas
 * dejaría el área invisible para el motor.
 */
export class UpdateAcademicAreaDto extends PartialType(CreateAcademicAreaDto) {
  @ApiProperty({
    required: false,
    description: 'Un área inactiva deja de ofrecerse en los formularios, pero conserva su historial.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
