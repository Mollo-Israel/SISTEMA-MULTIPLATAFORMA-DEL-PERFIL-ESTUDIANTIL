import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ConstanciesService } from './constancies.service';
import { CreateInternalConstancyDto } from './dto/create-internal-constancy.dto';

@ApiTags('constancies')
@ApiBearerAuth()
@Controller('constancies/internal')
export class ConstanciesController {
  constructor(private readonly constanciesService: ConstanciesService) {}

  @Post()
  @Roles(
    RolNombre.TEACHER,
    RolNombre.CAREER_DIRECTOR,
    RolNombre.SCIENTIFIC_SOCIETY,
    RolNombre.ADMIN,
  )
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInternalConstancyDto) {
    return this.constanciesService.create(user, dto);
  }

  @Get('my')
  @Roles(RolNombre.STUDENT)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.constanciesService.findMine(user.userId);
  }

  @Get('student/:studentId')
  @Roles(
    RolNombre.TEACHER,
    RolNombre.CAREER_DIRECTOR,
    RolNombre.SCIENTIFIC_SOCIETY,
    RolNombre.ADMIN,
  )
  findByStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.constanciesService.findByStudent(studentId);
  }
}
