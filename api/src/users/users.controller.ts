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
import { SetStatusDto } from './dto/set-status.dto';
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
  create(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, admin.userId);
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
  @ApiOperation({
    summary: 'Cambiar el estado de una cuenta.',
    description:
      'Retirar el acceso revoca las sesiones abiertas y los enlaces de activación '
      + 'pendientes. No elimina historial (§85).',
  })
  setStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
  ) {
    return this.usersService.setStatus(id, dto.status, admin.userId);
  }

  @Post(':id/resend-activation')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reenviar el enlace de activación de una cuenta provisionada.' })
  resendActivation(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.resendActivation(id, admin.userId);
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

  /**
   * Da de baja a un usuario (§85).
   *
   * No borra: §85 prefiere `status = INACTIVE` sobre el borrado, porque de un
   * perfil estudiantil cuelga todo su historial en cascada. Se cierra el acceso
   * y se revocan sus sesiones.
   */
  @Delete(':id')
  @Roles(RolNombre.ADMIN)
  @ApiOperation({
    summary: 'Da de baja a un usuario (§85).',
    description:
      'Cambia su estado a inactivo y revoca sus sesiones. La cuenta conserva su historial. '
      + 'Para eliminarla de verdad, use ?hard=true; solo funciona en cuentas sin historial.',
  })
  async remove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('hard') hard?: string,
  ) {
    if (hard === 'true') {
      await this.usersService.remove(id, admin.userId);
      return { deleted: true };
    }
    return this.usersService.deactivate(id, admin.userId);
  }
}
