import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({ description: 'ID del usuario integrante' })
  @IsUUID('4')
  userId: string;

  @ApiProperty({ required: false, example: 'Desarrollador backend' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @ApiProperty({ required: false, example: 'Implementó la API y la base de datos.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  contribution?: string;
}
