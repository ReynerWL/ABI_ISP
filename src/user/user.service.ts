import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { RoleService } from '#/role/role.service';
import { Role } from '#/role/entities/role.entity';
import { randomUUID } from 'crypto';
import { hashPassword } from '#/auth/hashpassword';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class UserService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    if (createUserDto.email) {
      if (
        await this.userRepository.findOne({
          where: { email: createUserDto.email },
        })
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'email already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check if phone number already exists
    if (createUserDto.phone_number) {
      if (
        await this.userRepository.findOne({
          where: { phone_number: createUserDto.phone_number },
        })
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'phone number already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const role = await this.dataSource.manager.findOneOrFail(Role, {
      where: { name: createUserDto.role },
    });

    // Create new user
    const data = new User();

    data.name = createUserDto.name;
    data.email = createUserDto.email;
    data.name = createUserDto.name;
    data.phone_number = createUserDto.phone_number;
    data.photo_ktp = createUserDto.photo_ktp;
    data.role = role;
    data.salt = randomUUID();
    data.password = await hashPassword(createUserDto.password, data.salt);
    data.alamat = createUserDto.alamat;
    data.status = createUserDto.status;
    data.priority = createUserDto.priority;

    // Insert new user into the repository
    const result = await this.userRepository.insert(data);

    return {
      data: await this.userRepository.findOne({
        where: { id: result.identifiers[0].id },
      }),
    };
  }

  async register(registerDto: RegisterDto) {
    if (registerDto.email) {
      if (
        await this.userRepository.findOne({
          where: { email: registerDto.email },
        })
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'email already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Check if phone number already exists
    if (registerDto.phone_number) {
      if (
        await this.userRepository.findOne({
          where: { phone_number: registerDto.phone_number },
        })
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'phone number already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const data = new User();

    data.name = registerDto.name;
    data.email = registerDto.email;
    data.name = registerDto.name;
    data.phone_number = registerDto.phone_number;
    data.alamat = registerDto.alamat;
    data.photo_ktp = registerDto.photo_ktp;
    data.salt = randomUUID();
    data.password = await hashPassword(registerDto.password, data.salt);
    data.status = 'PENDING';
    data.role = await this.dataSource.manager.findOneOrFail(Role, {
      where: { name: 'USER' },
    });

    const result = await this.userRepository.insert(data);

    return {
      data: await this.userRepository.findOne({
        where: { id: result.identifiers[0].id },
      }),
    };
  }

  async findAll(
    query: string,
    startDate: string,
    endDate: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    if (query) {
      qb.andWhere('user.name LIKE :query OR user.email LIKE :query', {
        query: `%${query}%`,
      });
    }

    if (startDate && endDate) {
      qb.andWhere('user.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOneOrFail({
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

  async findByCustomerId(customerId: string) {
    const user = await this.userRepository.findOne({
      where: {id: customerId,role: {name: 'CUSTOMER'}} ,
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

  async findExpiredUsers() {
    return this.userRepository.find({
      where: {
        status: 'EXPIRED',
      },
      relations: ['role'],
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOneOrFail({
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

    if (updateUserDto.email) {
      if (
        await this.userRepository.findOne({
          where: { email: updateUserDto.email },
        })
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'email already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (updateUserDto.phone_number) {
      if (
        await this.userRepository.findOne({
          where: { phone_number: updateUserDto.phone_number },
        })
      ) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'phone number already used',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const role = await this.dataSource.manager.findOneOrFail(Role, {
      where: { name: updateUserDto.role },
    });

    const data = new User();

    data.name = updateUserDto.name;
    data.email = updateUserDto.email;
    data.name = updateUserDto.name;
    data.phone_number = updateUserDto.phone_number;
    data.photo_ktp = updateUserDto.photo_ktp;
    data.role = role;
    data.salt = randomUUID();
    data.password = await hashPassword(updateUserDto.password, data.salt);
    data.alamat = updateUserDto.alamat;
    data.status = updateUserDto.status;
    data.priority = updateUserDto.priority;

    await this.userRepository.update(id, data);

    return {
      data: await this.userRepository.findOne({ where: { id: id } }),
    };
  }

  async remove(id: string) {
    const user = await this.userRepository.findOneOrFail({
      where: { id },
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

    await this.userRepository.softDelete(id);

    return {
      message: 'User deleted successfully',
    };
  }
}
