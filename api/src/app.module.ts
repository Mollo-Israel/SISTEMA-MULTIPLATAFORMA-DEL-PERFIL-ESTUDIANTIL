import { BackedSkillsModule } from './backed-skills/backed-skills.module';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { rateLimits } from './config/identity.config';
import { buildDatabaseConfig } from './config/database.config';
import { HealthController } from './health/health.controller';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';
import { IdentityModule } from './identity/identity.module';
import { ImportsModule } from './imports/imports.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ValidationModule } from './validation/validation.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ActivitiesModule } from './activities/activities.module';
import { ProjectsModule } from './projects/projects.module';
import { CertificatesModule } from './certificates/certificates.module';
import { ConstanciesModule } from './constancies/constancies.module';
import { ReportsModule } from './reports/reports.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { StorageModule } from './storage/storage.module';
import { EvidencesModule } from './evidences/evidences.module';
import { ProjectFeedbackModule } from './project-feedback/project-feedback.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { AiModule } from './ai/ai.module';
import { HelpModule } from './help/help.module';
import { GamificationModule } from './gamification/gamification.module';
import { RequestIdMiddleware } from './common/request-context';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildDatabaseConfig(config),
    }),
    // §15: límite global generoso. Los endpoints sensibles —login, activación,
    // recuperación— lo estrechan en su propio controlador.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      // Un unico limitador: con varios nombrados, todos se aplican a cada
      // ruta salvo que se salten explicitamente, y el login habria quedado
      // limitado por el perfil de activacion.
      useFactory: (config: ConfigService) => [
        { name: 'default', ttl: 60_000, limit: rateLimits.global(config) },
      ],
    }),
    AuditModule,
    BackedSkillsModule,
    MailModule,
    IdentityModule,
    ImportsModule,
    OnboardingModule,
    ValidationModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ProfilesModule,
    ActivitiesModule,
    ProjectsModule,
    CertificatesModule,
    ConstanciesModule,
    ReportsModule,
    CatalogsModule,
    StorageModule,
    EvidencesModule,
    ProjectFeedbackModule,
    RecommendationsModule,
    CollaborationModule,
    AiModule,
    HelpModule,
    GamificationModule,
  ],
  controllers: [HealthController],
  providers: [
    // El orden importa: primero se descarta el abuso, luego se identifica y por
    // último se autoriza.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * §102: cada peticion entra con su identificador.
   *
   * Va como middleware y no como interceptor porque tiene que estar puesto
   * antes de que cualquier cosa falle: un error en un guard ocurre antes de
   * los interceptores, y sin identificador ese error no se puede rastrear,
   * que es justo cuando mas falta hace.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
