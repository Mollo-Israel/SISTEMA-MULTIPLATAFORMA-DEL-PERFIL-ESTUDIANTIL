import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { MAX_PROJECT_IMAGES, ProjectGalleryService } from './project-gallery.service';

class AddProjectImageDto {
  @IsUUID('4', { message: 'La imagen no es válida.' }) fileId: string;
}

class UpdateProjectImageDto {
  @IsOptional() @IsBoolean() isCover?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_PROJECT_IMAGES - 1) position?: number;
}

const TODOS = [RolNombre.STUDENT, RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.SCIENTIFIC_SOCIETY, RolNombre.ADMIN];

/**
 * V5 BATCH 13 (§13.4): imágenes de muestra y «Proyectos de la carrera».
 * Se registra antes que `ProjectsController` para que `community` no se lea
 * como el `:id` de un proyecto.
 */
@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectGalleryController {
  constructor(private readonly gallery: ProjectGalleryService) {}

  @Get('community')
  @Roles(...TODOS)
  @ApiOperation({ summary: '«Proyectos de la carrera»: solo ACTIVE y visibles para quien consulta; 6 por página.' })
  community(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('areaId') areaId?: string,
    @Query('skillId') skillId?: string,
    @Query('page') page?: string,
  ) {
    return this.gallery.community(user, { q, areaId, skillId, page: Number(page) || 1 });
  }

  @Get(':id/images')
  @Roles(...TODOS)
  @ApiOperation({ summary: 'Imágenes de muestra del proyecto (0 a 5), para quien puede verlo.' })
  list(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gallery.list(user, id);
  }

  @Post(':id/images')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Agregar una imagen de muestra (PNG, JPG o WEBP; hasta 5). La primera es la portada.' })
  add(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddProjectImageDto) {
    return this.gallery.add(user, id, dto.fileId);
  }

  @Patch(':id/images/:imageId')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Elegir portada o cambiar el orden.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateProjectImageDto,
  ) {
    return this.gallery.update(user, id, imageId, dto);
  }

  @Delete(':id/images/:imageId')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Quitar una imagen de muestra. Si era la portada, pasa a serlo la primera.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.gallery.remove(user, id, imageId);
  }
}
