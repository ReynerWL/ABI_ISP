// src/mikrotik/mikrotik.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { MikrotikService } from './mikrotik.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Add if you want authentication

@Controller('api/mikrotik')
// @UseGuards(JwtAuthGuard) // Uncomment if you want to secure the endpoints
export class MikrotikController {
  private readonly logger = new Logger('MikrotikController');

  constructor(private readonly mikrotikService: MikrotikService) {}

  /**
   * ✅ Test MikroTik connection
   */
  @Get('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @Query('id') connectionId?: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🧪 Testing connection (ID: ${connectionId || 'default'})`);
    return this.mikrotikService.testConnection(connectionId);
  }

  /**
   * ✅ Get all Simple Queues from MikroTik
   */
  @Get('queues')
  @HttpCode(HttpStatus.OK)
  async getQueues(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ): Promise<{ success: boolean; data?: any[]; message?: string }> {
    this.logger.log(`📋 Fetching queues (Page: ${page}, Limit: ${limit})`);
    return this.mikrotikService.getQueueList();
  }

  /**
   * ✅ Enable a queue by ID
   */
  @Post('queue/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableQueue(
    @Param('id') queueId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`✅ Enabling queue ID: ${queueId}`);
    return this.mikrotikService.enableQueueById(queueId);
  }

  /**
   * ✅ Disable a queue by ID
   */
  @Post('queue/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableQueue(
    @Param('id') queueId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔴 Disabling queue ID: ${queueId}`);
    return this.mikrotikService.disableQueueById(queueId);
  }

  /**
   * ✅ Get all users with their IP addresses (from your DB + MikroTik mapping)
   */
  @Get('users-with-ips')
  @HttpCode(HttpStatus.OK)
  async getUsersWithIps(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    this.logger.log('👥 Fetching users with IP mappings');
    return this.mikrotikService.getUsersWithIps();
  }

  /**
   * ✅ Block a user by their internal User ID (not MikroTik username)
   */
  @Post('block/:userId')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔒 Blocking user via User ID: ${userId}`);
    return this.mikrotikService.blockUserByUserId(userId);
  }

  /**
   * ✅ Unblock a user by their internal User ID
   */
  @Post('unblock/:userId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔓 Unblocking user via User ID: ${userId}`);
    return this.mikrotikService.unblockUserByUserId(userId);
  }

  /**
   * ✅ Get status of a specific user by their internal User ID
   */
  @Get('status/:userId')
  async getUserStatus(
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    this.logger.log(`📊 Getting status for user ID: ${userId}`);
    return this.mikrotikService.getUserStatusByUserId(userId);
  }

  /**
   * ✅ Get status of all users (from MikroTik)
   */
  @Get('all-users-status')
  async getAllUsersStatus() {
    this.logger.log('📋 Fetching status for all MikroTik users');
    return this.mikrotikService.getAllUsersWithStatus();
  }

  /**
   * ✅ Add a new user mapping (link your internal User ID to a MikroTik username/IP)
   */
  @Post('mapping')
  @HttpCode(HttpStatus.CREATED)
  async addUserMapping(
    @Body('userId') userId: string,
    @Body('mikrotikUsername') mikrotikUsername: string,
    @Body('ipAddress') ipAddress: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`🔗 Adding user mapping: ${userId} → ${mikrotikUsername} (${ipAddress})`);
    return this.mikrotikService.addUserMapping(userId, mikrotikUsername, ipAddress);
  }
}