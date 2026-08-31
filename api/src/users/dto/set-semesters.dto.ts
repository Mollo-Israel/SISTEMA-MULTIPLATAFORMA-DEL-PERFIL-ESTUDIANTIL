import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, Max, Min } from 'class-validator';

/**
 * Semestres que el administrador habilita a un docente para consultar perfiles
 * de estudiantes (RF3). Reemplaza el conjunto completo; un arreglo vacio deja
 * al docente sin semestres habilitados.
 */
export class SetTeacherSemestersDto {
  @ApiProperty({
    type: [Number],
    example: [3, 4, 5],
    description: 'Semestres habilitados (1 a 8). Reemplaza el conjunto completo.',
  })
  @IsArray()
  @ArrayMaxSize(8, { message: 'Como máximo se pueden habilitar 8 semestres.' })
  @ArrayUnique({ message: 'No se permiten semestres duplicados.' })
  @IsInt({ each: true, message: 'Cada semestre debe ser un número entero.' })
  @Min(1, { each: true, message: 'El semestre mínimo es 1.' })
  @Max(8, { each: true, message: 'El semestre máximo es 8.' })
  semesters: number[];
}
