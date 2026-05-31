import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty({ example: 'GraphQL' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ required: false, description: 'Área académica asociada' })
  @IsOptional()
  @IsUUID('4')
  academicAreaId?: string;
}
