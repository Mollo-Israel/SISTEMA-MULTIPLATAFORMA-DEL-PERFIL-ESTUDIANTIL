import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RolNombre, UserStatus } from '@perfil/shared';
import { User } from '../entities/user.entity';
import { RolesService } from '../roles/roles.service';
import { PublicUser, toPublicUser } from './types/public-user';

interface CreateUserParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: RolNombre;
  status?: UserStatus;
}

interface UpdateUserParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: RolNombre;
  status?: UserStatus;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly rolesService: RolesService,
  ) {}

  async create(params: CreateUserParams): Promise<PublicUser> {
    const email = params.email.toLowerCase().trim();
    await this.assertEmailAvailable(email);

    const role = await this.rolesService.findByName(params.role);
    const passwordHash = await bcrypt.hash(params.password, 10);

    const user = this.usersRepository.create({
      firstName: params.firstName,
      lastName: params.lastName,
      email,
      passwordHash,
      roleId: role.id,
      status: params.status ?? UserStatus.ACTIVE,
    });
    const saved = await this.usersRepository.save(user);
    saved.role = role;
    return toPublicUser(saved);
  }

  async findAll(): Promise<PublicUser[]> {
    const users = await this.usersRepository.find({
      relations: { role: true },
      order: { createdAt: 'DESC' },
    });
    return users.map(toPublicUser);
  }

  async findOne(id: string): Promise<PublicUser> {
    return toPublicUser(await this.findEntityOrFail(id));
  }

  async update(id: string, params: UpdateUserParams): Promise<PublicUser> {
    const user = await this.findEntityOrFail(id);

    if (params.email && params.email.toLowerCase().trim() !== user.email) {
      const email = params.email.toLowerCase().trim();
      await this.assertEmailAvailable(email);
      user.email = email;
    }
    if (params.firstName !== undefined) user.firstName = params.firstName;
    if (params.lastName !== undefined) user.lastName = params.lastName;
    if (params.status !== undefined) user.status = params.status;
    if (params.role !== undefined) {
      const role = await this.rolesService.findByName(params.role);
      user.roleId = role.id;
      user.role = role;
    }

    const saved = await this.usersRepository.save(user);
    return toPublicUser(saved);
  }

  async setActive(id: string, active: boolean): Promise<PublicUser> {
    const user = await this.findEntityOrFail(id);
    user.status = active ? UserStatus.ACTIVE : UserStatus.INACTIVE;
    return toPublicUser(await this.usersRepository.save(user));
  }

  async remove(id: string): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Usuario no encontrado: ${id}`);
    }
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: { role: true },
    });
  }

  private async findEntityOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { role: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario no encontrado: ${id}`);
    }
    return user;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('El correo ya está registrado.');
    }
  }
}
