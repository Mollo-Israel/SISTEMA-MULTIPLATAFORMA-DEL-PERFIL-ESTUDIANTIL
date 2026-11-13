import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LibraryService } from './library.service';

/** Los filtros de la biblioteca, tal como llegan en la URL. */
interface FiltrosDeBiblioteca {
  q?: string;
  areaId?: string;
  skillId?: string;
  type?: string;
  favorites?: string;
  forMe?: string;
  limit?: string;
  offset?: string;
}

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
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'areaId', required: false })
  @ApiQuery({ name: 'skillId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'favorites', required: false })
  @ApiQuery({ name: 'forMe', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  listar(@CurrentUser() user: AuthenticatedUser, @Query() f: FiltrosDeBiblioteca) {
    const { q, areaId, skillId, type, favorites, forMe, limit, offset } = f;
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
