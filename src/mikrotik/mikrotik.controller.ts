// src/mikrotik/mikrotik.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { MikrotikService } from './mikrotik.service';
import { JwtAuthGuard } from '../core/jwt-auth.guard';
import { User } from '../user/entities/user.entity';
import { BlockUserDto } from './dto/block-user.dto';

@Controller('mikrotik')
@UseGuards(JwtAuthGuard)
export class MikrotikController {
  constructor(private mikrotikService: MikrotikService) {}

  @Post('block')
  async blockUser(@Body() dto: BlockUserDto, @Req() req) {
    const user = req.user as User;
    const success = await this.mikrotikService.blockUser(dto.username);
    return { success, action: 'block', username: dto.username };
  }

  @Post('unblock')
  async unblockUser(@Body() dto: BlockUserDto, @Req() req) {
    const user = req.user as User;
    const success = await this.mikrotikService.unblockUser(dto.username);
    return { success, action: 'unblock', username: dto.username };
  }
}
