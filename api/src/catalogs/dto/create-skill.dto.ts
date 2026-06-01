import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { cleanLine } from '../../common/validation';

export class CreateSkillDto {
  @ApiProperty({ example: 'GraphQL' })
  @Transform(cleanLine)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la habilidad es obligatorio.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name: string;

  @ApiProperty({ required: false, description: 'Área académica asociada' })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;
}
