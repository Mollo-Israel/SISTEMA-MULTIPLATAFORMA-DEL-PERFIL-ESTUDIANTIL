import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AffinityEngineService } from './affinity.engine';

@ApiTags('affinity')
@ApiBearerAuth()
@Controller('affinity')
export class AffinityController {
  constructor(private readonly engine: AffinityEngineService) {}

  @Post('recalculate/me')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  async recalculateMine(@CurrentUser() user: AuthenticatedUser) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.recalculate(profileId);
  }

  @Post('recalculate/:studentId')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  @HttpCode(200)
  async recalculateStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.engine.recalculate(studentId);
  }

  @Get('me')
  @Roles(RolNombre.STUDENT)
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    const profileId = await this.engine.resolveProfileIdByUser(user.userId);
    return this.engine.getForProfile(profileId);
  }

  @Get('student/:studentId')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  async getStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    await this.engine.assertProfileExists(studentId);
    return this.engine.getForProfile(studentId);
  }

  @Get('map/basic')
  @Roles(RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  async basicMap() {
    return this.engine.basicMap();
  }
}
