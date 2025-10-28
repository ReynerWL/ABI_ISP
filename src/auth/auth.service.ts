import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityNotFoundError, In, Repository } from 'typeorm';
import { User } from '#/user/entities/user.entity';
import { UserService } from '#/user/user.service';
import { hashPassword } from './hashpassword';
import { Role } from '#/role/entities/role.entity';
import { JwtService } from '@nestjs/jwt';
import { PasswordResetToken } from '#/user/entities/passwordresettoken';
import { add } from 'date-fns';
import { sendEmail } from '#/core/send-email';
import { ForgetPasswordDto } from './dto/forget-password';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepository: Repository<PasswordResetToken>,
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

    if (dataUser.status != 'Aktif' && dataUser.role.name == 'Admin') {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          error: `User status is ${dataUser.status}, access denied`,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }else if (dataUser.role.name == 'ADMIN' && dataUser.status == 'Aktif'){
      await this.usersRepository.update(dataUser.id, {
        last_login: new Date(),
      });
    }

    const accessToken = await this.createToken(dataUser.id);

    return { accessToken: accessToken };
  }

  async findUser(email: string) {
    try {
      const data = await this.usersRepository.findOneOrFail({
        where: { email },
        relations: ['role'],
        select: [
          'id',
          'email',
          'name',
          'phone_number',
          'salt',
          'password',
          'status',
          'role',
        ],
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

  async forgetPassword(forgetPasswordDto: ForgetPasswordDto) {
    const validate = await this.validatePasswordToken(forgetPasswordDto.token);

    if (!validate) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Password Reset Token not valid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await Promise.all([
      this.changePassword(validate.email, forgetPasswordDto.new_password),
      this.tokenRepository.update({ id: validate.id }, { status: 'inactive' }),
    ]);
  }

  async sendToken(email: string) {
    const token = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');

    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Users with this email not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // nonaktifkan token lama
    const checkExistToken = await this.tokenRepository.find({
      where: { email, status: 'active' },
    });

    if (checkExistToken.length > 0) {
      await this.tokenRepository.update(
        { id: In(checkExistToken.map((t) => t.id)) },
        { status: 'inactive' },
      );
    }

    // simpan token baru & kirim email
    await Promise.all([
      this.tokenRepository.save(
        this.tokenRepository.create({
          email,
          token,
          user,
          expired_date: add(new Date(), { minutes: 5 }),
          status: 'active',
        }),
      ),
      sendEmail({
        to: user.email,
        subject: 'Password Reset',
        text: token,
        html: `<h1>Password Reset Token</h1>
          <p>Here is your password reset token: <strong>${token}</strong></p>
          <p>This token is valid for 5 minutes.</p>`,
      }),
    ]);
  }

  async changePassword(email: string, new_password: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'User not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const newPassword = await hashPassword(new_password, user.salt);

    await this.usersRepository.update(user.id, { password: newPassword });
  }

  async validatePasswordToken(token: string) {
    return await this.tokenRepository.findOne({
      where: { token, status: 'active' },
    });
  }
}
