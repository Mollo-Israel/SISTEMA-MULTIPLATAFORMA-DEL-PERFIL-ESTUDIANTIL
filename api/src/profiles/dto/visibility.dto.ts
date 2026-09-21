import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PublicProfileField } from '@perfil/shared';

/**
 * Campos que el estudiante acepta mostrar en su perfil compartible (§44).
 *
 * Cada campo es opcional: se envía solo lo que cambia. Y la lista es cerrada:
 * el correo institucional, los archivos privados y los identificadores
 * internos no tienen entrada aquí, de modo que ninguna combinación de valores
 * puede llegar a exponerlos.
 */
export class VisibilityFieldsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.BIO]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.AREAS]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.AFFINITIES]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.SUPPORT_LEVEL]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.PROJECTS]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.SKILLS]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.AVAILABILITY]?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  [PublicProfileField.TRAJECTORY]?: boolean;
}

export class UpdateVisibilityDto {
  @ApiProperty({
    required: false,
    description:
      'Activa o desactiva el perfil compartible. Desactivado, ninguna configuración de campos surte efecto.',
  })
  @IsOptional()
  @IsBoolean({ message: 'El perfil compartible se activa o se desactiva.' })
  publicProfileEnabled?: boolean;

  @ApiProperty({ required: false, type: VisibilityFieldsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => VisibilityFieldsDto)
  fields?: VisibilityFieldsDto;
}
