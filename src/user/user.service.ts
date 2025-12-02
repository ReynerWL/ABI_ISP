import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { CreateAdminDto, CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserStatus } from './entities/user.entity';
import { DataSource, ILike, Repository } from 'typeorm';
import { Role } from '#/role/entities/role.entity';
import { randomInt, randomUUID } from 'crypto';
import { hashPassword } from '#/auth/hashpassword';
import { RegisterDto } from './dto/register.dto';
import { Payment } from '#/payment/entities/payment.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { Bank } from '#/bank/entities/bank.entity';
import { PaginationDto } from '#/utils/pagination.dto';
import { logger } from 'handlebars';
import { Subscription } from '#/subscription/entities/subscription.entity';
import { WhatsAppService } from '#/WA/bot/wa.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class UserService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly WaSvc: WhatsAppService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const roleRepo = manager.getRepository(Role);
      const paketRepo = manager.getRepository(Paket);
      const bankRepo = manager.getRepository(Bank);
      const paymentRepo = manager.getRepository(Payment);
      const subsRepo = manager.getRepository(Subscription);

      if (createUserDto.email) {
        const existingUser = await userRepo.findOne({
          where: { email: createUserDto.email },
        });
        if (existingUser) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'email already used',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (createUserDto.phone_number) {
        const existingUser = await userRepo.findOne({
          where: { phone_number: createUserDto.phone_number },
        });
        if (existingUser) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'phone number already used',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (createUserDto.role == 'ADMIN' || createUserDto.role == 'SUPERADMIN') {
        throw new HttpException(
          {
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Cannot assign ADMIN or SUPERADMIN role',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const role = await roleRepo.findOneOrFail({
        where: { name: ILike(createUserDto.role) },
      });
      const paket = await paketRepo.findOneOrFail({
        where: { id: createUserDto.paketsId },
      });
      const bank = await bankRepo.findOneOrFail({
        where: { id: createUserDto.bankId },
      });

      const data = new User();
      data.name = createUserDto.name;
      data.email = createUserDto.email;
      data.phone_number = createUserDto.phone_number;
      data.photo_ktp = createUserDto.photo_ktp;
      data.role = role;
      data.salt = randomUUID();
      data.password = await hashPassword(createUserDto.password, data.salt);
      data.alamat = createUserDto.alamat;
      data.status = createUserDto.status;
      data.priority = createUserDto.priority;
      data.ip_address = createUserDto.ip_address;
      data.paket = paket;
      data.provinsi = createUserDto.provinsi;
      data.kota = createUserDto.kota;
      data.kecamatan = createUserDto.kecamatan;
      data.kelurahan = createUserDto.kelurahan;
      data.birth_date = createUserDto.birth_date;
      data.paket = await manager.getRepository(Paket).findOneOrFail({
        where: { id: createUserDto.paketsId },
      });

      const userCount = (await userRepo.count()) + 1;
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const sequential = userCount.toString().padStart(4, '0');
      data.customerId = `${sequential}${year}${month}${day}`;

      const savedUser = await userRepo.save(data);

      if (createUserDto.is_pelanggan_lama == true) {
        const payment = await paymentRepo.save({
          user: savedUser,
          paket: paket,
          bank: bank,
          buktiPembayaran: createUserDto.bukti_pembayaran,
          status: 'CONFIRMED',
          start_date: createUserDto.pelanggan_lama.start_date,
          due_date: createUserDto.pelanggan_lama.due_date,
          paidAt: createUserDto.pelanggan_lama.paid_at || new Date(),
          confirmedAt: new Date(),
          price: paket.price,
        });

        await subsRepo.save({
          banks: bank,
          paket: paket,
          user: savedUser,
          start_date: payment.start_date,
          due_date: payment.due_date,
        });

        await this.WaSvc.sendMigrationWelcome(
          savedUser.phone_number,
          savedUser.name,
          savedUser.email,
          savedUser.password,
        );
      }

      const userWithRelations = await userRepo.findOne({
        where: { id: savedUser.id },
        relations: { role: true, subscription: true },
      });

      return {
        data: userWithRelations || savedUser, // Return saved user
      };
    });
  }

  async register(registerDto: RegisterDto) {
    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const paketRepo = manager.getRepository(Paket);
      const roleRepo = manager.getRepository(Role);
      const bankRepo = manager.getRepository(Bank);
      const paymentRepo = manager.getRepository(Payment);

      if (registerDto.email) {
        const exists = await userRepo.findOne({
          where: { email: registerDto.email },
        });
        if (exists) {
          throw new BadRequestException(
            'Email ini sudah terdaftar, silahkan gunakan email lain',
          );
        }
      }

      if (registerDto.phone_number) {
        const existsPhone = await userRepo.findOne({
          where: { phone_number: registerDto.phone_number },
        });
        if (existsPhone) {
          throw new BadRequestException('Nomor telepon ini sudah terdaftar');
        }
      }

      const role = await roleRepo.findOneOrFail({
        where: { name: ILike(`user`) },
      });

      const data = new User();
      data.email = registerDto.email;
      data.name = registerDto.name;
      data.phone_number = registerDto.phone_number;
      data.alamat = registerDto.alamat;
      data.photo_ktp = registerDto.photo_ktp;
      data.salt = randomUUID();
      data.password = await hashPassword(registerDto.password, data.salt);
      data.birth_date = registerDto.birth_date;
      data.provinsi = registerDto.provinsi;
      data.kota = registerDto.kota;
      data.status = UserStatus.BARU;
      data.kecamatan = registerDto.kecamatan;
      data.kelurahan = registerDto.kelurahan;
      data.role = role;
      data.paket = await paketRepo.findOneOrFail({
        where: { id: registerDto.payment.paketId },
      });

      const userCount = (await userRepo.count()) + 1;
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const sequential = userCount.toString().padStart(4, '0');
      data.customerId = `${sequential}${year}${month}${day}`;

      const savedUser = await userRepo.save(data);

      const payment = new Payment();
      const bank: Bank | null = await bankRepo.findOne({
        where: { id: registerDto.payment.banksId },
      });
      const paket = await paketRepo.findOneOrFail({
        where: { id: registerDto.payment.paketId },
      });
      payment.paket = paket;
      payment.bank = bank ?? undefined;
      payment.user = savedUser;
      payment.price = paket.price;
      payment.buktiPembayaran = registerDto.payment.buktiPembayaran;
      payment.status = 'PENDING';
      payment.paidAt = new Date();

      const savedPayment = await paymentRepo.save(payment);

      const userWithRelations = await userRepo.findOne({
        where: { id: savedUser.id },
        relations: ['role', 'paket'], // Fetch necessary relations
      });

      const paymentWithRelations = await paymentRepo.findOne({
        where: { id: savedPayment.id },
        relations: ['paket', 'bank', 'user'], // Fetch necessary relations
      });

      setImmediate(() => {
        this.WaSvc.sendWelcomeMessage(
          payment.user?.phone_number,
          userWithRelations.name,
          userWithRelations.customerId,
          payment.id,
        ).catch((err) => {
          console.error('Failed to send WA message:', err);
        });
      });

      return {
        data: userWithRelations,
        payment: paymentWithRelations,
        Status: HttpStatus.CREATED,
      };
    });
  }

  async createAdmin(createAdminDto: CreateAdminDto, roles: string) {
    console.log(roles);

    if (roles != 'SUPERADMIN') {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'You do not have permission to create an admin',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    const roleRepo = this.dataSource.getRepository(Role);

    const role = await roleRepo.findOneOrFail({
      where: { name: ILike(`admin`) },
    });

    const data = new User();
    data.name = createAdminDto.name;
    data.email = createAdminDto.email;
    data.phone_number = createAdminDto.phone_number;
    data.role = role;
    data.salt = randomUUID();
    data.password = await hashPassword(createAdminDto.password, data.salt);
    data.status = createAdminDto.status;

    const savedUser = await this.userRepository.save(data);

    const userWithRelations = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['role'],
    });

    return userWithRelations || savedUser; // Return saved user
  }

  async findAll(
    search: string,
    status: string,
    paket_speed: string,
    paket: string,
    role: string,
    created_at: string,
    startDate: string,
    endDate: string,
    paginationDto: PaginationDto,
  ) {
    const { page, limit } = paginationDto;
    try {
      const qb = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.paket', 'paket');

      if (status) {
        qb.andWhere('user.status = :status', { status });
      }

      if (search) {
        qb.andWhere(
          '(user.name ILIKE :search OR user.email ILIKE :search OR user.customerId ILIKE :search)',
          { search: `%${search}%` },
        );
      }

      if (paket_speed) {
        const pakets = paket_speed.split(',').map((p) => p.trim());
        qb.andWhere('paket.speed IN (:...pakets)', { pakets });
      }

      if (paket) {
        if (paket.toLowerCase() === 'asc') {
          qb.addOrderBy('paket.speed', 'ASC');
        } else if (paket.toLowerCase() === 'desc') {
          qb.addOrderBy('paket.speed', 'DESC');
        }
      }

      role = role.toLocaleUpperCase();
      if (role) {
        qb.andWhere('role.name = :role', { role });
      }

      if (created_at) {
        if (created_at.toLowerCase() == 'asc') {
          qb.addOrderBy('user.createdAt', 'ASC');
        } else if (created_at.toLowerCase() == 'desc') {
          qb.addOrderBy('user.createdAt', 'DESC');
        }
      }

      if (startDate && endDate) {
        qb.andWhere('user.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      if (paginationDto) {
        qb.skip((page - 1) * limit).take(limit);
      }

      const [data, total] = await qb.getManyAndCount();

      const pagination = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      return {
        data,
        pagination,
      };
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'An error occurred while fetching users',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async exportUsersToExcel(
    paket_id?: string,
    status?: string,
    startDate?: string,
    endDate?: string,
  ) {
    try {
      const qb = this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.paket', 'paket');

      // Filter paket_id
      if (paket_id) {
        qb.andWhere('paket.id = :paket_id', { paket_id });
      }

      // Filter status
      if (status) {
        qb.andWhere('user.status = :status', { status });
      }

      // Filter tanggal createdAt
      if (startDate && endDate) {
        qb.andWhere('user.createdAt BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        });
      }

      qb.andWhere('role.name ILIKE :role', { role: `user` });

      qb.orderBy('user.createdAt', 'DESC');

      const users = await qb.getMany();

      // =====================================
      // EXCEL GENERATION
      // =====================================
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Users');

      sheet.columns = [
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Customer ID', key: 'customerId', width: 20 },
        { header: 'Phone Number', key: 'phone', width: 20 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Package', key: 'paket', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 25 },
      ];

      users.forEach((u) => {
        sheet.addRow({
          name: u.name,
          email: u.email,
          customerId: u.customerId,
          phone: u.phone_number,
          role: u.role?.name,
          paket: u.paket?.name,
          status: u.status,
          createdAt: u.createdAt,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Failed to export users',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.paket', 'paket')
      .leftJoinAndSelect('user.subscription', 'subscription')
      .leftJoinAndSelect('subscription.paket', 'subPaket')
      .leftJoinAndSelect('user.payments', 'payments')
      .leftJoinAndSelect('payments.paket', 'paymentPaket')
      .leftJoinAndSelect('payments.bank', 'paymentBank')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'user not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // ⬅️ Urutkan payments secara manual setelah query
    if (user.payments && Array.isArray(user.payments)) {
      user.payments.sort((a, b) => {
        const tA = new Date(a.createdAt).getTime();
        const tB = new Date(b.createdAt).getTime();
        return tB - tA; // latest first
      });
    }

    return user;
  }

  async findOneByUser(userId: string) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.paket', 'paket')
      .leftJoinAndSelect('user.subscription', 'subscription')
      .leftJoinAndSelect('subscription.paket', 'subPaket')
      .leftJoinAndSelect('user.payments', 'payments')
      .leftJoinAndSelect('payments.paket', 'paymentPaket')
      .leftJoinAndSelect('payments.bank', 'paymentBank')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'user not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Urutkan payments terbaru → lama
    if (user.payments && Array.isArray(user.payments)) {
      user.payments.sort((a, b) => {
        const aT = new Date(a.createdAt).getTime();
        const bT = new Date(b.createdAt).getTime();
        return bT - aT; // latest first
      });
    }

    // Hitung jumlah payment
    const paymentCount = user.payments?.length ?? 0;

    // Susun ulang response seperti format sebelumnya
    const { payments, ...rest } = user;

    return {
      ...rest,
      payments: {
        data: payments || [],
        count: paymentCount,
      },
    };
  }

  async findByCustomerId(customerId: string) {
    const user = await this.userRepository.findOne({
      where: { id: customerId, role: { name: 'CUSTOMER' } },
      relations: ['role', 'payment', 'paket', 'subscription'],
    });
    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'user not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  async findExpiredUsers() {
    return this.userRepository.find({
      where: {
        status: UserStatus.NONAKTIF,
      },
      relations: ['role', 'paket', 'subscription', 'payment'],
    });
  }

  async findActiveUsers() {
    return this.userRepository.find({
      where: {
        status: UserStatus.AKTIF,
      },
      relations: ['role', 'paket', 'subscription', 'payment'],
    });
  }

  async markAsExpired(userId: string) {
    return this.userRepository.update(userId, { status: UserStatus.NONAKTIF });
  }

  async update(id: string, updateUserDto: UpdateUserDto, roles: string) {
    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const paketRepo = manager.getRepository(Paket);
      const paymentRepo = manager.getRepository(Payment);

      const user = await this.findOne(id);

      if (!user) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            error: 'User not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await userRepo.findOne({
          where: { email: updateUserDto.email },
        });
        if (existingUser) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'Email already used',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (
        updateUserDto.phone_number &&
        updateUserDto.phone_number !== user.phone_number
      ) {
        const existingUser = await userRepo.findOne({
          where: { phone_number: updateUserDto.phone_number },
        });
        if (existingUser) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              error: 'Phone number already used',
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const updateData = new User();
      updateData.name = updateUserDto.name;
      updateData.email = updateUserDto.email;
      updateData.phone_number = updateUserDto.phone_number;
      updateData.photo_ktp = updateUserDto.photo_ktp;
      updateData.alamat = updateUserDto.alamat;
      updateData.status = updateUserDto.status;
      updateData.ip_address = updateUserDto.ip_address;
      updateData.paket = user.paket;
      updateData.buktiPemasangan = updateUserDto.buktiPemasangan;
      updateData.tanggalPemasangan = updateUserDto.tanggalPemasangan;

      // Handle password update if provided
      if (updateUserDto.password) {
        user.salt = randomUUID();
        user.password = await hashPassword(updateUserDto.password, user.salt);
        updateData.salt = user.salt;
        updateData.password = user.password;
      }

      await this.userRepository.update(user.id, updateData);

      let createdPayment: Payment | null = null;
      // Handle paket change and create pending payment if paketId is provided
      if (updateUserDto.paketsId && updateUserDto.paketsId !== user.paket?.id) {
        const newPaket = await paketRepo.findOne({
          where: { id: updateUserDto.paketsId },
        });
        if (!newPaket) {
          throw new HttpException(
            {
              statusCode: HttpStatus.NOT_FOUND,
              error: 'Paket not found',
            },
            HttpStatus.NOT_FOUND,
          );
        }

        const payment = new Payment();
        payment.user = user;
        payment.paket = newPaket;
        payment.price = newPaket.price;
        payment.status = 'PENDING';
        payment.buktiPembayaran = updateUserDto.buktiPembayaran || '';

        //search already exist pending payment fot this user
        const existingPendingPayment = await paymentRepo.findOne({
          where: { user: { id: user.id }, status: 'PENDING' },
        });

        if (existingPendingPayment) {
          await paymentRepo.remove(existingPendingPayment);
        }

        createdPayment = await paymentRepo.save(payment);
      }

      const userWithRelations = await userRepo.findOne({
        where: { id: user.id },
        relations: { role: true, paket: true },
      });

      return {
        data: userWithRelations,
        ...(createdPayment && { newPayment: createdPayment }),
        message: createdPayment
          ? `User updated successfully. A new pending payment (#${createdPayment.id}) has been created for the requested package change.`
          : 'User updated successfully.',
      };
    });
  }

  async updateStatus(id: string, roles: string) {
    if (roles !== 'SUPERADMIN') {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'You do not have permission to update user status',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'user not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    user.status =
      user.status === UserStatus.AKTIF ? UserStatus.NONAKTIF : UserStatus.AKTIF;

    const savedUser = await this.userRepository.save(user);

    return savedUser;
  }

  async remove(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'user not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.userRepository.softDelete(id);

    return {
      message: 'User deleted successfully',
    };
  }
}
