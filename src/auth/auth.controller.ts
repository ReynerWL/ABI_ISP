import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Public } from './public.decorator';
import { JwtAuthGuard } from '#/core/jwt-auth.guard';
import { ExtendedRequest } from '#/core/request';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { SendTokenDto } from './dto/send-token';
import { ValidatePasswordTokenDto } from './dto/validate-password-token';
import { ForgetPasswordDto } from './dto/forget-password';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async loginUser(@Body() loginDto: LoginDto) {
    return {
      data: await this.authService.login(loginDto),
      statusCode: HttpStatus.OK,
      message: 'Login Successful',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('validate-token')
  async validateToken(@Request() req: ExtendedRequest) {
    return {
      message: 'Token Is Valid',
      data: req.user,
    };
  }

  @Post('forget-password/send-token')
  async sendToken(@Body() sendTokenDto: SendTokenDto) {
    await this.authService.sendToken(sendTokenDto.email);

    return {
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }

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

  @Post('forget-password')
  async forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    await this.authService.forgetPassword(forgetPasswordDto);

    return {
      statusCode: HttpStatus.OK,
      message: 'success',
    };
  }
}
