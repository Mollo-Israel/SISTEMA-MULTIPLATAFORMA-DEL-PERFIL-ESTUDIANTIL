import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetActiveDto } from './dto/set-active.dto';
import { SetTeacherSemestersDto } from './dto/set-semesters.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(RolNombre.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear usuario institucional (docente, director o sociedad).' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuarios, con búsqueda opcional por nombre o correo.' })
  @ApiQuery({ name: 'search', required: false, description: 'Nombre, apellido o correo' })
  @ApiQuery({ name: 'role', required: false, enum: RolNombre })
  findAll(@Query('search') search?: string, @Query('role') role?: RolNombre) {
    return this.usersService.findAll(search, role);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto) {
    return this.usersService.setActive(id, dto.active);
  }

  @Get(':id/semesters')
  @ApiOperation({ summary: 'Semestres habilitados de un docente.' })
  getSemesters(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getTeacherSemesters(id);
  }

  @Put(':id/semesters')
  @ApiOperation({ summary: 'Reemplazar los semestres habilitados de un docente.' })
  setSemesters(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTeacherSemestersDto,
  ) {
    return this.usersService.setTeacherSemesters(id, dto.semesters, admin.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
