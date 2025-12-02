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
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

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

    if (
      dataUser.status != 'Aktif' &&
      dataUser.role.name.toLocaleUpperCase() == 'Admin'
    ) {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          error: `User status is ${dataUser.status}, access denied`,
        },
        HttpStatus.UNAUTHORIZED,
      );
    } else if (
      dataUser.role.name.toLocaleUpperCase() == 'Admin' &&
      dataUser.status == 'Aktif'
    ) {
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

  async sendResetLink(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new HttpException(
        { statusCode: HttpStatus.NOT_FOUND, error: 'Email tidak ditemukan' },
        HttpStatus.NOT_FOUND,
      );
    }

    // generate unique token
    const token = randomUUID();
    const expired = add(new Date(), { minutes: 15 });

    await this.usersRepository.update(user.id, {
      reset_token: token,
      reset_token_expired: expired,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset',
      text: resetLink,
      html: `
        <h2>Reset Password</h2>
        <p>Klik link di bawah ini untuk mengubah password Anda:</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>Link ini berlaku selama 15 menit.</p>
      `,
    });

    return { message: 'Reset link dikirim ke email Anda' };
  }

  async validateResetToken(token: string) {
    const user = await this.usersRepository.findOne({
      where: { reset_token: token },
    });

    if (!user || new Date(user.reset_token_expired) < new Date()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Token tidak valid atau sudah kadaluarsa',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return user;
  }

  async resetPassword(token: string, new_password: string) {
    const user = await this.validateResetToken(token);
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newPassword = await hashPassword(new_password, newSalt);

    user.reset_token = null;
    user.reset_token_expired = null;

    await this.usersRepository.update(user.id, {
      password: newPassword,
      salt: newSalt,
    });

    return { message: 'Password berhasil diubah' };
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
      this.resetPassword(validate.token, forgetPasswordDto.new_password),
      this.tokenRepository.update({ id: validate.id }, { status: 'inactive' }),
    ]);

    return { message: 'Password changed successfully' };
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
        { statusCode: HttpStatus.NOT_FOUND, error: 'User not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Perbaikan: generate salt jika tidak ada
    let salt = user.salt;
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }

    const newPassword = await hashPassword(new_password, salt);

    await this.usersRepository.update(user.id, {
      password: newPassword,
      salt,
    });
  }

  async validatePasswordToken(token: string) {
    return await this.tokenRepository.findOne({
      where: { token, status: 'active' },
    });
  }
}
