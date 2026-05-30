import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { RolNombre, UserStatus } from '@perfil/shared';
import { UsersService } from '../users/users.service';
import { PublicUser, toPublicUser } from '../users/types/public-user';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/authenticated-user';

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: dto.password,
      role: RolNombre.STUDENT,
    });
    return { accessToken: this.signToken(user), user };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const entity = await this.usersService.findByEmailWithPassword(dto.email);
    if (!entity) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    if (entity.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('La cuenta está inactiva.');
    }
    const valid = await bcrypt.compare(dto.password, entity.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }
    const user = toPublicUser(entity);
    return { accessToken: this.signToken(user), user };
  }

  me(userId: string): Promise<PublicUser> {
    return this.usersService.findOne(userId);
  }

  private signToken(user: PublicUser): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }
}
