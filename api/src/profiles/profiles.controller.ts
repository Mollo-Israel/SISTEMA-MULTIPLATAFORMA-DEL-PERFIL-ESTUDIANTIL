import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ReplaceInterestsDto, SetInterestsDto } from './dto/set-interests.dto';
import { ReplaceSkillsDto, SetSkillsDto } from './dto/set-skills.dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('students')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  listStudents(@Query('search') search?: string) {
    return this.profilesService.listStudents(search);
  }

  @Post('me')
  @Roles(RolNombre.STUDENT)
  createMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProfileDto) {
    return this.profilesService.createMyProfile(user.userId, dto);
  }

  @Get('me')
  @Roles(RolNombre.STUDENT)
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getOwnProfile(user.userId);
  }

  @Patch('me')
  @Roles(RolNombre.STUDENT)
  updateMyProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profilesService.updateMyProfile(user.userId, dto);
  }

  @Post('me/interests')
  @Roles(RolNombre.STUDENT)
  addInterests(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetInterestsDto) {
    return this.profilesService.addInterests(user.userId, dto.items);
  }

  @Put('me/interests')
  @Roles(RolNombre.STUDENT)
  replaceInterests(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceInterestsDto) {
    return this.profilesService.replaceInterests(user.userId, dto.items);
  }

  @Post('me/skills')
  @Roles(RolNombre.STUDENT)
  addSkills(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetSkillsDto) {
    return this.profilesService.addSkills(user.userId, dto.items);
  }

  @Put('me/skills')
  @Roles(RolNombre.STUDENT)
  replaceSkills(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceSkillsDto) {
    return this.profilesService.replaceSkills(user.userId, dto.items);
  }

  @Get('me/summary')
  @Roles(RolNombre.STUDENT)
  getMySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getSummary(user.userId);
  }

  @Get(':studentId/allowed')
  @Roles(RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN)
  getAllowedView(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.profilesService.getAllowedView(studentId);
  }
}
