import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AccountToken } from '../entities/account-token.entity';
import { AuthSession } from '../entities/auth-session.entity';
import { User } from '../entities/user.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { AccountTokensService } from './account-tokens.service';
import { AuthSessionsService } from './auth-sessions.service';
import { ActivationService } from './activation.service';
import { ActivationController } from './activation.controller';

/**
 * Identidad: activación, recuperación y sesiones (especificación §12 y §14).
 *
 * Se exporta lo que el resto necesita —tokens y sesiones— porque tanto la
 * importación de padrón como la gestión de usuarios emiten activaciones y
 * revocan sesiones, y esa lógica debe existir en un solo sitio.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AccountToken, AuthSession, User, StudentProfile]),
    ConfigModule,
  ],
  controllers: [ActivationController],
  providers: [AccountTokensService, AuthSessionsService, ActivationService],
  exports: [AccountTokensService, AuthSessionsService, ActivationService],
})
export class IdentityModule {}
