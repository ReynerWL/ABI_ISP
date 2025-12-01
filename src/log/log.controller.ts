import { Controller, Get, HttpStatus, Query, Request } from '@nestjs/common';
import { LogService } from './log.service';
import { ExtendedRequest } from '#/core/request';
import { SkipLogging } from '#/logging/skip-logging.decorator';

@Controller('log')
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get()
  @SkipLogging()
  async findAll(
    @Request() req: ExtendedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.logService.findAll(req.user.role, +page, +limit);

    return {
      statusCode: HttpStatus.OK,
      message: 'Success',
      ...result, // ⬅️ spread result, tidak membungkus ke "data"
    };
  }
}
