// src/mikrotik/mikrotik.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { MikrotikService } from './mikrotik.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Add auth if needed

@Controller('api/mikrotik')
// @UseGuards(JwtAuthGuard) // Secure your API
export class MikrotikController {
  constructor(private readonly mikrotikService: MikrotikService) {}

  @Post('test-connection/:id?')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Param('id') connectionId?: string) {
    return this.mikrotikService.testConnection(connectionId);
  }

  @Post('block/:userId')
  @HttpCode(HttpStatus.OK)
  async blockUser(@Param('userId') userId: string) {
    return this.mikrotikService.blockUserByUserId(userId);
  }

  @Post('unblock/:userId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(@Param('userId') userId: string) {
    return this.mikrotikService.unblockUserByUserId(userId);
  }

  @Get('status/:userId')
  async getUserStatus(@Param('userId') userId: string) {
    return this.mikrotikService.getUserStatusByUserId(userId);
  }

  @Get('users')
  async getAllUsers() {
    return this.mikrotikService.getAllUsersWithStatus();
  }

  @Post('mapping')
  @HttpCode(HttpStatus.CREATED)
  async addUserMapping(
    @Body('userId') userId: string,
    @Body('mikrotikUsername') mikrotikUsername: string,
    @Body('ipAddress') ipAddress: string,
  ) {
    return this.mikrotikService.addUserMapping(userId, mikrotikUsername, ipAddress);
  }
}