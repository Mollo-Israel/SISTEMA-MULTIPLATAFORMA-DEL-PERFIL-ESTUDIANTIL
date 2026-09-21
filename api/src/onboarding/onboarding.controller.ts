import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { OnboardingService } from './onboarding.service';
import { ConfirmOnboardingDto, SubmitOnboardingDto } from './dto/onboarding.dto';

/**
 * Cuestionario Inicial de Orientación Académica (especificacion §16).
 *
 * Es del estudiante y de nadie más: ni docentes ni dirección acceden a las
 * respuestas. Lo que sale del cuestionario y sí se comparte son los intereses
 * que el estudiante decide incorporar, que ya forman parte de su perfil.
 */
@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('onboarding')
@Roles(RolNombre.STUDENT)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('questionnaire')
  @ApiOperation({
    summary: 'Obtener el cuestionario vigente.',
    description:
      'Devuelve las preguntas y sus opciones, con la versión del banco. '
      + 'Orienta preferencias: no evalúa conocimiento ni produce competencias.',
  })
  questionnaire() {
    return this.onboarding.questionnaire();
  }

  @Get('me')
  @ApiOperation({
    summary: 'Mi cuestionario vigente.',
    description:
      'Incluye si queda pendiente de confirmar qué áreas incorporar como intereses.',
  })
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.current(user.userId);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Todas mis pasadas del cuestionario. Puede repetirse.' })
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.history(user.userId);
  }

  @Post('runs')
  @ApiOperation({
    summary: 'Responder el cuestionario.',
    description:
      'Calcula las áreas sugeridas y las guarda, pero **no crea ningún interés**: '
      + 'solo la confirmación posterior los crea (§16).',
  })
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitOnboardingDto) {
    return this.onboarding.submit(user.userId, dto);
  }

  @Post('runs/:runId/confirm')
  @ApiOperation({
    summary: 'Incorporar como intereses las áreas elegidas.',
    description:
      'Solo admite áreas que el propio cuestionario haya sugerido. Confirmar sin '
      + 'elegir ninguna también es válido y cierra el cuestionario.',
  })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() dto: ConfirmOnboardingDto,
  ) {
    return this.onboarding.confirm(user.userId, runId, dto);
  }
}
