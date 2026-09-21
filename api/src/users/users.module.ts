import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { TeacherSemesterAccess } from '../entities/teacher-semester-access.entity';
import { RolesModule } from '../roles/roles.module';
import { IdentityModule } from '../identity/identity.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, TeacherSemesterAccess]), RolesModule, IdentityModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
