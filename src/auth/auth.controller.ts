import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  UseGuards,
  Request,
  HttpException,
} from '@nestjs/common';
import { Public } from './public.decorator';
import { JwtAuthGuard } from '#/core/jwt-auth.guard';
import { ExtendedRequest } from '#/core/request';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { SendTokenDto } from './dto/send-token';
import { ValidatePasswordTokenDto } from './dto/validate-password-token';
import { ForgetPasswordDto } from './dto/forget-password';
import { DataSource } from 'typeorm';
import { User } from '#/user/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private dataSource: DataSource
  ) {}

  @Public()
  @Post('login')
  async loginUser(@Body() loginDto: LoginDto) {
    return {
      data: await this.authService.login(loginDto),
      statusCode: HttpStatus.OK,
      message: 'Login Successful',
    };
  }

  @Get('validate-token')
  async validateToken(@Request() req: ExtendedRequest) {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: req.user.id },
      relations: ['role'],
    });

    if (user.status != 'Aktif' && user.role.name == 'Admin') {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNAUTHORIZED,
          error: `User status is ${user.status}, access denied`,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      message: 'Token Is Valid',
      data: { ...req.user, email: user.email, role: user.role.name },
      statusCode: HttpStatus.OK,
  }
}

@Public()
  @Post('forget-password/send-token')
  async sendToken(@Body() sendTokenDto: SendTokenDto) {
    await this.authService.sendToken(sendTokenDto.email);

    return {
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Public()
  @Post('forget-password/validate')
  async validatePasswordToken(
    @Body() validatePasswordToken: ValidatePasswordTokenDto,
  ) {
    const data = await this.authService.validatePasswordToken(
      validatePasswordToken.token,
    );

    return {
      data: data ? 'valid' : 'not valid',
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Public()
  @Post('forget-password')
  async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    await this.authService.forgetPassword(forgetPasswordDto);

    return {
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

  @Post('forget-password/send-link')
  async sendResetLink(@Body() body: SendTokenDto) {
    return this.authService.sendResetLink(body.email);
  }

  @Post('forget-password/reset')
  async resetPassword(@Body() body: ForgetPasswordDto) {
    return this.authService.resetPassword(body.token, body.new_password);
  }
}
