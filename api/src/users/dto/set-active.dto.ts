import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetActiveDto {
  @ApiProperty({ example: true, description: 'true = activar, false = desactivar' })
  @IsBoolean()
  active: boolean;
}
