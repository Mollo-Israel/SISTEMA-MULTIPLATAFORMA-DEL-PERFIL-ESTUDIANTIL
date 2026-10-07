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
import { ArrayUnique, IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CV_SUMMARY_MAX, CvTemplate, RolNombre, TrajectorySection } from '@perfil/shared';
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

  /** V2 §61.2. */
  @ApiProperty({ enum: CvTemplate, required: false })
  @IsOptional()
  @IsEnum(CvTemplate, { message: 'Plantilla no válida.' })
  template?: CvTemplate;

  /** V2 §61.3: presentación propia o una sugerencia ya aceptada. */
  @ApiProperty({ required: false, maxLength: CV_SUMMARY_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(CV_SUMMARY_MAX, { message: `La presentación no puede superar ${CV_SUMMARY_MAX} caracteres.` })
  summaryText?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID('4')
  summaryAiRunId?: string;

  /**
   * V3 §43.2: ítems concretos por sección, en el orden en que deben salir
   * (`{ "projects": ["<id>", …] }`). Una sección sin lista incluye todos sus
   * ítems elegibles. Lo valida el servicio: solo ids elegibles y propios.
   */
  @ApiProperty({ required: false, type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } })
  @IsOptional()
  @IsObject({ message: 'La selección de ítems no es válida.' })
  items?: Partial<Record<TrajectorySection, string[]>>;
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

  @Get('trajectory-summary/items')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Ítems elegibles por sección para el currículo (V3 §43.2, §43.3).',
    description: 'Proyectos activos y corroborados o revisados, participaciones confirmadas, credenciales '
      + 'corroboradas. Dice cuántos quedan fuera y por qué.',
  })
  async items(@CurrentUser() user: AuthenticatedUser) {
    return this.summary.eligibleItems(await this.profileId(user));
  }

  @Get('trajectory/me')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({
    summary: 'Mi trayectoria: histórico completo con el nivel de cada cosa (V3 §42).',
    description: 'Declarado, con respaldo, corroborado, revisado o inconcluso, en lenguaje natural.',
  })
  async history(@CurrentUser() user: AuthenticatedUser) {
    return this.summary.history(await this.profileId(user));
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
    return this.summary.build(await this.profileId(user), dto.sections ?? [], this.opciones(user, dto));
  }

  /** Lo mismo que la vista previa, en PDF y con plantilla (V2 §61). */
  @Post('trajectory-summary/pdf')
  @Roles(RolNombre.STUDENT)
  @Header('Content-Type', 'application/pdf')
  @ApiOperation({ summary: 'CV en PDF con plantilla y presentación aprobada (V2 §61).' })
  async pdfPost(
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
    @Body() dto: BuildTrajectorySummaryDto,
  ) {
    const { filename, buffer } = await this.summary.buildPdf(
      await this.profileId(user),
      dto.sections ?? [],
      this.opciones(user, dto),
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }

  private opciones(user: AuthenticatedUser, dto: BuildTrajectorySummaryDto) {
    return {
      template: dto.template,
      summaryText: dto.summaryText ?? null,
      summaryAiRunId: dto.summaryAiRunId ?? null,
      userId: user.userId,
      items: dto.items ?? null,
    };
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
    @Query('template') template?: string,
  ) {
    const elegidas = (sections ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is TrajectorySection =>
        (Object.values(TrajectorySection) as string[]).includes(s));

    const plantilla = (Object.values(CvTemplate) as string[]).includes(template ?? '')
      ? (template as CvTemplate)
      : undefined;
    const { filename, buffer } = await this.summary.buildPdf(
      await this.profileId(user),
      elegidas,
      { template: plantilla, userId: user.userId },
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.end(buffer);
  }
}
