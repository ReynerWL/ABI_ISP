import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '#/user/entities/user.entity';
import { Role } from '#/role/entities/role.entity';
import { hashPassword } from '#/auth/hashpassword';
import * as crypto from 'crypto';

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAll();
  }

  async seedAll() {
    this.logger.log('Checking database seed status...');

    // 1. Seed Roles (SUPERADMIN, ADMIN, USER)
    const rolesToSeed = ['SUPERADMIN', 'ADMIN', 'USER'];
    const roleEntities: Record<string, Role> = {};

    for (const roleName of rolesToSeed) {
      let role = await this.roleRepository.findOne({ where: { name: roleName } });
      if (!role) {
        role = this.roleRepository.create({ name: roleName });
        await this.roleRepository.save(role);
        this.logger.log(`Created ${roleName} role.`);
      }
      roleEntities[roleName] = role;
    }

    // 2. Seed Superadmin User
    const superadminEmail = 'mediabuanainti@gmail.com';
    const superadminSalt = '54750fdb-1cec-4769-b37a-b46e0deb5566';
    const superadminPassword = await hashPassword('Masjidku#2026', superadminSalt);

    await this.seedUser(
      superadminEmail,
      superadminPassword,
      superadminSalt,
      'Super Admin',
      roleEntities['SUPERADMIN'],
      'SA',
    );

    // 3. Seed 3 Admin Users
    const adminPasswordRaw = 'mbinetadmin2026';
    for (let i = 1; i <= 3; i++) {
      const adminEmail = `admin${i}@mbinet.com`;
      const adminSalt = crypto.randomUUID();
      const adminPassword = await hashPassword(adminPasswordRaw, adminSalt);

      await this.seedUser(
        adminEmail,
        adminPassword,
        adminSalt,
        `Admin ${i}`,
        roleEntities['ADMIN'],
        'AD',
      );
    }

    this.logger.log('Seed check finished: database is populated.');
  }

  private async seedUser(
    email: string,
    passwordHash: string,
    salt: string,
    name: string,
    role: Role,
    prefix: string,
  ) {
    const existingUser = await this.userRepository.findOne({ where: { email } });

    if (existingUser) {
      this.logger.log(`User with email ${email} already exists. Skipping.`);
      return;
    }

    const randomStr = Math.random().toString(36).substring(7);

    const user = this.userRepository.create({
      name: name,
      email: email,
      password: passwordHash,
      salt: salt,
      role: role,
      phone_number: '8' + Math.floor(100000000 + Math.random() * 900000000),
      customerId: `${prefix}-` + randomStr.toUpperCase(),
      status: UserStatus.AKTIF,
      ip_address: `127.0.0.${Math.floor(Math.random() * 255) + 1}`,
      alamat: 'Random Address ' + randomStr,
      provinsi: 'DKI Jakarta',
      kota: 'Jakarta Selatan',
      kecamatan: 'Kebayoran',
      kelurahan: 'Senayan',
      priority: role.name === 'SUPERADMIN',
    });

    await this.userRepository.save(user);
    this.logger.log(`Successfully seeded ${role.name} user: ${email}`);
  }
}
