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
      user: req.user,
    };
  }
}
