import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAcademicAreaDto } from './create-academic-area.dto';

export class UpdateAcademicAreaDto extends PartialType(CreateAcademicAreaDto) {
  @ApiProperty({
    required: false,
    description: 'Un área inactiva deja de ofrecerse en los formularios, pero conserva su historial.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
