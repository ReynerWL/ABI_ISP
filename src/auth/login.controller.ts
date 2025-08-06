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
import { LoginService } from './login.service';

@Controller('login')
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Public()
  @Post()
  async loginUser(@Body() loginDto: LoginDto) {
    return {
      data: await this.loginService.login(loginDto),
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
