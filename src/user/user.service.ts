import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User, UserStatus } from './entities/user.entity';
import { DataSource, ILike, Repository } from 'typeorm';
import { Role } from '#/role/entities/role.entity';
import { randomUUID } from 'crypto';
import { hashPassword } from '#/auth/hashpassword';
import { RegisterDto } from './dto/register.dto';
import { Payment } from '#/payment/entities/payment.entity';
import { Paket } from '#/paket/entities/paket.entity';
import { Bank } from '#/bank/entities/bank.entity';
import { PaginationDto } from '#/utils/pagination.dto';

@Injectable()
export class UserService {
  constructor(
    private dataSource: DataSource, 
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const roleRepo = manager.getRepository(Role);

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

      const role = await roleRepo.findOneOrFail({
        where: { name: createUserDto.role },
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

      const userCount = (await userRepo.count()) + 1;
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const sequential = userCount.toString().padStart(4, '0');
      data.customerId = `${sequential}${year}${month}${day}`;

      const savedUser = await userRepo.save(data); 

      const userWithRelations = await userRepo.findOne({
         where: { id: savedUser.id },
         relations: ['role'] 
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

      const paket = await paketRepo.findOneOrFail({
        where: { id: registerDto.payment.paketId },
      });

      const role = await roleRepo.findOneOrFail({
        where: { name: ILike(`%user%`) }, 
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
      data.kecamatan = registerDto.kecamatan;
      data.kelurahan = registerDto.kelurahan;
      data.role = role;
      data.paket = paket; 

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
      payment.paket = paket;
      payment.bank = bank ?? undefined; 
      payment.user = savedUser; 
      payment.price = registerDto.payment.price;
      payment.buktiPembayaran = registerDto.payment.buktiPembayaran;
      payment.status = 'PENDING';

      const savedPayment = await paymentRepo.save(payment); 

      const userWithRelations = await userRepo.findOne({
        where: { id: savedUser.id },
        relations: ['role', 'paket'], // Fetch necessary relations
      });

      const paymentWithRelations = await paymentRepo.findOne({
        where: { id: savedPayment.id },
        relations: ['paket', 'bank', 'user'], // Fetch necessary relations
      });

      return {
        data: userWithRelations,
        payment: paymentWithRelations,
        Status: HttpStatus.CREATED,
      };
    });
  }


  async findAll(
    search: string,
    startDate: string,
    endDate: string,
    status: string,
    paginationDto: PaginationDto,
  ) {
    const { page, limit } = paginationDto;

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
  }

  async findOne(id: string) {
     const user = await this.userRepository.findOne({
      where: { id },
      relations: ['role'],
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

  async findOneByUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        role: true,
        paket: true,
        payments: true,
        subscription: true,
      },
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

    const paymentCount = await this.userRepository.manager
      .getRepository(Payment)
      .count({
        where: { user: { id: userId } },
      });

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

  async update(id: string, updateUserDto: UpdateUserDto) {
    return await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      // const roleRepo = manager.getRepository(Role); // Uncomment if updating role

      const user = await userRepo.findOne({
         where: { id },
         relations: ['role'] 
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

      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await userRepo.findOne({
          where: { email: updateUserDto.email },
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

      if (updateUserDto.phone_number && updateUserDto.phone_number !== user.phone_number) { 
         const existingUser = await userRepo.findOne({
           where: { phone_number: updateUserDto.phone_number },
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


      const updateData: Partial<User> = {};
      if (updateUserDto.name !== undefined) updateData.name = updateUserDto.name;
      if (updateUserDto.email !== undefined) updateData.email = updateUserDto.email;
      if (updateUserDto.phone_number !== undefined) updateData.phone_number = updateUserDto.phone_number;
      if (updateUserDto.photo_ktp !== undefined) updateData.photo_ktp = updateUserDto.photo_ktp;
      if (updateUserDto.alamat !== undefined) updateData.alamat = updateUserDto.alamat;
      if (updateUserDto.password) {
         user.salt = randomUUID();
         user.password = await hashPassword(updateUserDto.password, user.salt);
      }

      Object.assign(user, updateData);

      const savedUser = await userRepo.save(user); // Save using transactional manager

      const userWithRelations = await userRepo.findOne({
         where: { id: savedUser.id },
         relations: ['role'] 
      });

      return {
        data: userWithRelations || savedUser, // Return updated user
      };
    });

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
