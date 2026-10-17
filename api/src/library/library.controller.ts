import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LibraryService } from './library.service';

/** Biblioteca de recursos (V3.2 §35). */
@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  @ApiOperation({
    summary: 'Recursos vigentes con búsqueda, filtros por área, habilidad y tipo, y favoritos (V3.2 §35.1).',
  })
  listar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('areaId') areaId?: string,
    @Query('skillId') skillId?: string,
    @Query('type') type?: string,
    @Query('favorites') favorites?: string,
    @Query('forMe') forMe?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
    return this.library.listar(user, {
      q: q?.slice(0, 100), areaId: uuid(areaId), skillId: uuid(skillId), type,
      favorites: favorites === 'true' || favorites === '1', forMe: forMe === 'true' || forMe === '1', limit: Number(limit), offset: Number(offset),
    });
  }

  @Put(':id/favorite')
  @Roles(RolNombre.STUDENT)
  @HttpCode(200)
  @ApiOperation({ summary: 'Guardar un recurso como favorito (no aporta afinidad, §35.3).' })
  guardar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.library.favorito(user, id, true);
  }

  @Delete(':id/favorite')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Quitar un recurso de favoritos.' })
  quitar(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.library.favorito(user, id, false);
  }
}
