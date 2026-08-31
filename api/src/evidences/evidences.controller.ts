import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EvidencesService } from './evidences.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@ApiTags('evidences')
@ApiBearerAuth()
@Roles(RolNombre.STUDENT, RolNombre.ADMIN)
@Controller('evidences')
export class EvidencesController {
  constructor(private readonly evidencesService: EvidencesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Registrar una evidencia (enlace o archivo) asociada a un proyecto, una actividad o un área.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEvidenceDto) {
    return this.evidencesService.create(user, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Evidencias registradas por el estudiante.' })
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.evidencesService.findMine(user.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar una evidencia propia; también borra el archivo asociado.' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.evidencesService.remove(user, id);
  }
}
