import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RolNombre, UserStatus } from '@perfil/shared';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/user.entity';

export async function seedAdminUser(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);

  const email = process.env.ADMIN_EMAIL ?? 'admin@univalle.edu';
  const existing = await userRepo.findOne({ where: { email } });
  if (existing) {
    return;
  }

  const adminRole = await roleRepo.findOne({ where: { name: RolNombre.ADMIN } });
  if (!adminRole) {
    return;
  }

  // §13 exige 12 caracteres como minimo. Este valor solo sirve para el
  // arranque inicial en desarrollo; en cualquier despliegue real se define
  // ADMIN_PASSWORD por entorno.
  const password = process.env.ADMIN_PASSWORD ?? 'AfiniaAdmin2026*';
  const passwordHash = await bcrypt.hash(password, 10);

  await userRepo.save(
    userRepo.create({
      firstName: 'Administrador',
      lastName: 'Sistema',
      email,
      passwordHash,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
    }),
  );
}
