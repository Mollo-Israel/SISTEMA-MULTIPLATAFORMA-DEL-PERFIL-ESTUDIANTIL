import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { trim } from '../../common/validation';

export class CreateSkillDto {
  @ApiProperty({ example: 'GraphQL' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la habilidad es obligatorio.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  name: string;

  @ApiProperty({ required: false, description: 'Área académica asociada' })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;
}
