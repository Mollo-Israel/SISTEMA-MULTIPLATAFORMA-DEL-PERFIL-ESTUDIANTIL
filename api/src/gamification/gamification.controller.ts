import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { RolNombre, TrajectorySection } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { StudentProfile } from '../entities/student-profile.entity';
import { GamificationService } from './gamification.service';
import { TrajectorySummaryService } from '../trajectory/trajectory-summary.service';

/** Secciones que el estudiante elige incluir (§67). */
export class BuildTrajectorySummaryDto {
  @ApiProperty({ enum: TrajectorySection, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @ArrayUnique({ message: 'No repita secciones.' })
  @IsEnum(TrajectorySection, { each: true, message: 'Sección no válida.' })
  sections?: TrajectorySection[];
}

/**
 * Progreso y resumen de trayectoria (§66, §67).
 *
 * Las dos cosas son del Estudiante y de nadie más. No hay ruta para consultar
 * los puntos de otra persona: §66 dice que el ranking público no es
 * obligatorio, y publicarlo convertiría un reconocimiento en una comparación
 * entre compañeros, que es lo contrario de lo que RN-15 permite hacer con
 * estos datos.
 */
@ApiTags('gamification')
@ApiBearerAuth()
@Controller()
export class GamificationController {
  constructor(
    private readonly gamification: GamificationService,
    private readonly summary: TrajectorySummaryService,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
  ) {}

  private async profileId(user: AuthenticatedUser): Promise<string> {
    const perfil = await this.profiles.findOne({
      where: { userId: user.userId },
      select: { id: true },
    });
    if (!perfil) {
      throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    }
    return perfil.id;
  }

  // =========================================================================
  // §66 · Progreso
  // =========================================================================

  @Get('gamification/me')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Puntos, insignias y progreso del estudiante (§66).',
    description:
      'Los puntos son independientes de la afinidad: nunca la alimentan. No hay tabla de '
      + 'posiciones ni comparación con otros estudiantes.',
  })
  async myProgress(@CurrentUser() user: AuthenticatedUser) {
    return this.gamification.summary(await this.profileId(user));
  }

  // =========================================================================
  // §67 · Resumen de trayectoria
  // =========================================================================

  @Get('trajectory-summary/sections')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Secciones que se pueden incluir en el resumen (§67).' })
  sections() {
    return this.summary.sections();
  }

  @Post('trajectory-summary/preview')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Arma el resumen con las secciones elegidas, para revisarlo antes de exportar.',
  })
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BuildTrajectorySummaryDto,
  ) {
    return this.summary.build(await this.profileId(user), dto.sections ?? []);
  }

  /**
   * Descarga el resumen en PDF (§67).
   *
   * `GET` y no `POST` porque un navegador descarga siguiendo un enlace, y las
   * secciones viajan en la consulta. La advertencia obligatoria va dentro del
   * documento, no en esta respuesta: el archivo circula solo.
   */
  @Get('trajectory-summary/pdf')
  @Roles(RolNombre.STUDENT)
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'Resumen de Trayectoria Académica Complementaria en PDF (§67).' })
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Query('sections') sections?: string,
  ) {
    const elegidas = (sections ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is TrajectorySection =>
        (Object.values(TrajectorySection) as string[]).includes(s));

    const { filename, buffer } = await this.summary.buildPdf(
      await this.profileId(user),
      elegidas,
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }
}
