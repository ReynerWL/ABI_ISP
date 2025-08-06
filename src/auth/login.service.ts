import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityNotFoundError, ILike, Repository } from 'typeorm';
import { User } from '#/user/entities/user.entity';
import { UserService } from '#/user/user.service';
import { hashPassword } from './hashpassword';
import { Role } from '#/role/entities/role.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class LoginService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const dataUser = await this.findUser(loginDto.email);
    const hashedPassword = await hashPassword(loginDto.password, dataUser.salt);
    const matched = hashedPassword === dataUser.password;

    if (!matched) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Invalid password',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const accessToken = await this.createToken(dataUser.id);

    return { accessToken: accessToken };
  }

  async findUser(email: string) {
    try {
      const data = await this.usersRepository.findOneOrFail({
        where: { email: ILike(email) },
      });

      return data;
    } catch (e) {
      if (e instanceof EntityNotFoundError) {
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'email not found',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      throw e;
    }
  }

  async createToken(userId: string) {
    const role = await this.roleRepository.findOne({
      where: {
        users: {
          id: userId,
        },
      },
    });
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    return this.jwtService.sign(
      {
        id: userId,
        role: role.name,
        name: user.name,
        username: user.name,
      },
      {
        algorithm: 'RS256',
        expiresIn: '1d',
      },
    );
  }
}
