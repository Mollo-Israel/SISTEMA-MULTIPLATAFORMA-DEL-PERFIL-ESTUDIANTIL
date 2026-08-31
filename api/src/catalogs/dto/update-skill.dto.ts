import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSkillDto } from './create-skill.dto';

export class UpdateSkillDto extends PartialType(CreateSkillDto) {
  @ApiProperty({
    required: false,
    description: 'Una habilidad inactiva deja de ofrecerse, pero conserva los registros existentes.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
