import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { IdentityModule } from '../identity/identity.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { resolveJwtSecret } from '../config/security.config';
import { identityConfig } from '../config/identity.config';

@Module({
  imports: [
    UsersModule,
    IdentityModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        // El access token es corto a proposito (§14): la sesion larga vive en
        // el refresh token, que si se puede revocar.
        signOptions: {
          expiresIn: `${identityConfig.accessTokenTtlMinutes(config)}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
