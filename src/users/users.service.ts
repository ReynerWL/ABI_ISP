import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PrismaService } from '#/core/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: Prisma.userCreateInput) {
    return this.prisma.user.create({
      data: createUserDto,
    });
    // const result = await this.usersRepository.insert(createUserDto);
    //
    // return this.usersRepository.findOneOrFail({
    //   where: {
    //     id: result.identifiers[0].id,
    //   },
    // });
  }

  async findAll() {
    return await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({}),
    ]);
  }

  async findOne(id: string) {
    const user = this.prisma.user.findFirst({
      where: {
        id,
      },
    });

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Data not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = this.prisma.user.updateMany({
      where: {
        id,
      },
      data: updateUserDto,
    });
    return user;
  }

  async remove(id: string) {
    await this.prisma.user.delete({
      where: {
        id,
      },
    });
  }
}
