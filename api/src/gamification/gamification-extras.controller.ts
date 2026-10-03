import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RolNombre } from '@perfil/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { StudentProfile } from '../entities/student-profile.entity';
import { cleanLine, cleanText, IsCatalogName } from '../common/validation';
import { GamificationExtrasService, Periodo } from './gamification-extras.service';

class ChallengeDto {
  @ApiProperty({ example: 'Laboratorio de SQL completo' })
  @Transform(cleanLine)
  @IsString({ message: 'Escriba el nombre del reto.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsCatalogName()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(400, { message: 'La descripción no puede superar 400 caracteres.' })
  description?: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt({ message: 'Los puntos deben ser un número entero, sin letras ni decimales.' })
  @Min(1, { message: 'Un reto da al menos 1 punto.' })
  @Max(100, { message: 'Un reto da como máximo 100 puntos.' })
  points: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'Área no válida.' })
  academicAreaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
class UpdateChallengeDto extends PartialType(ChallengeDto) {}

class AwardDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Elija al menos un estudiante.' })
  @ArrayMaxSize(100, { message: 'Como máximo 100 estudiantes a la vez.' })
  @IsUUID('4', { each: true, message: 'Estudiante no válido.' })
  studentProfileIds: string[];
}

class RewardDto {
  @ApiProperty({ example: 'Certificado de reconocimiento del curso' })
  @Transform(cleanLine)
  @IsString({ message: 'Escriba el nombre de la recompensa.' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres.' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsCatalogName()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(400, { message: 'La descripción no puede superar 400 caracteres.' })
  description?: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt({ message: 'El costo debe ser un número entero de puntos.' })
  @Min(1, { message: 'El costo mínimo es 1 punto.' })
  @Max(10000, { message: 'El costo máximo es 10 000 puntos.' })
  cost: number;

  @ApiPropertyOptional({ description: 'Unidades disponibles; vacío = sin límite.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Las unidades deben ser un número entero.' })
  @Min(0, { message: 'Las unidades no pueden ser negativas.' })
  @Max(100000, { message: 'Demasiadas unidades.' })
  stock?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
class UpdateRewardDto extends PartialType(RewardDto) {}

class ResolveDto {
  @ApiProperty({ enum: ['delivered', 'rejected'] })
  @IsIn(['delivered', 'rejected'], { message: 'Indique si se entregó o se rechaza.' })
  status: 'delivered' | 'rejected';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(300)
  note?: string;
}

const PERSONAL = [RolNombre.TEACHER, RolNombre.CAREER_DIRECTOR, RolNombre.ADMIN];

/**
 * Retos docentes, recompensas y puntos por periodo (correcciones de QA, §66).
 */
@ApiTags('gamification')
@ApiBearerAuth()
@Controller('gamification')
export class GamificationExtrasController {
  constructor(
    private readonly extras: GamificationExtrasService,
    @InjectRepository(StudentProfile) private readonly profiles: Repository<StudentProfile>,
  ) {}

  private async profileId(user: AuthenticatedUser): Promise<string> {
    const p = await this.profiles.findOne({ where: { userId: user.userId }, select: { id: true } });
    if (!p) throw new NotFoundException('Aún no has creado tu perfil estudiantil.');
    return p.id;
  }

  // ------------------------------------------------------------ estudiante
  @Get('me/wallet')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Mi saldo, mis puntos por periodo y mis canjes.' })
  async wallet(@CurrentUser() user: AuthenticatedUser) {
    const id = await this.profileId(user);
    const [balance, periods, redemptions] = await Promise.all([
      this.extras.balance(id),
      this.extras.periods(id),
      this.extras.myRedemptions(id),
    ]);
    return {
      balance,
      periods,
      redemptions: redemptions.map((r) => ({
        id: r.id, reward: r.reward?.name, cost: r.cost, status: r.status, note: r.note,
        createdAt: r.createdAt, resolvedAt: r.resolvedAt,
      })),
    };
  }

  @Post('rewards/:id/redeem')
  @Roles(RolNombre.STUDENT)
  @ApiOperation({ summary: 'Canjear puntos por una recompensa.' })
  async redeem(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.extras.redeem(await this.profileId(user), id);
  }

  // --------------------------------------------------------------- retos
  @Get('challenges')
  @Roles(...PERSONAL)
  @ApiOperation({ summary: 'Mis retos (todos, si soy administrador).' })
  challenges(@CurrentUser() user: AuthenticatedUser) {
    return this.extras.listChallenges(user);
  }

  @Post('challenges')
  @Roles(...PERSONAL)
  @ApiOperation({ summary: 'Crear un reto para mis estudiantes.' })
  createChallenge(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChallengeDto) {
    return this.extras.createChallenge(user, dto);
  }

  @Patch('challenges/:id')
  @Roles(...PERSONAL)
  updateChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChallengeDto,
  ) {
    return this.extras.updateChallenge(user, id, dto);
  }

  @Post('challenges/:id/award')
  @HttpCode(200)
  @Roles(...PERSONAL)
  @ApiOperation({
    summary: 'Reconocer un reto a estudiantes de mi alcance.',
    description: 'Cada estudiante se comprueba contra el alcance docente (§68). Un reto se reconoce una vez por estudiante.',
  })
  award(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AwardDto,
  ) {
    return this.extras.awardChallenge(user, id, dto.studentProfileIds);
  }

  @Get('scope-points')
  @Roles(...PERSONAL)
  @ApiOperation({ summary: 'Puntos del periodo de los estudiantes que acompaño. No es público.' })
  scopePoints(@CurrentUser() user: AuthenticatedUser, @Query('period') period?: string) {
    const p = (['week', 'month', 'year'].includes(period ?? '') ? period : 'month') as Periodo;
    return this.extras.scopePoints(user, p);
  }

  // ----------------------------------------------------------- recompensas
  @Get('rewards')
  @Roles(RolNombre.STUDENT, ...PERSONAL)
  @ApiOperation({ summary: 'Recompensas: las vigentes (estudiante) o las que ofrezco (personal).' })
  rewards(@CurrentUser() user: AuthenticatedUser) {
    return this.extras.listRewards(user);
  }

  @Post('rewards')
  @Roles(...PERSONAL)
  createReward(@CurrentUser() user: AuthenticatedUser, @Body() dto: RewardDto) {
    return this.extras.createReward(user, dto);
  }

  @Patch('rewards/:id')
  @Roles(...PERSONAL)
  updateReward(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    return this.extras.updateReward(user, id, dto);
  }

  @Get('redemptions')
  @Roles(...PERSONAL)
  @ApiOperation({ summary: 'Canjes de las recompensas que ofrezco.' })
  redemptions(@CurrentUser() user: AuthenticatedUser) {
    return this.extras.pendingRedemptions(user);
  }

  @Patch('redemptions/:id')
  @Roles(...PERSONAL)
  @ApiOperation({ summary: 'Marcar un canje como entregado o rechazarlo (los puntos vuelven).' })
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveDto,
  ) {
    return this.extras.resolveRedemption(user, id, dto.status, dto.note);
  }
}
