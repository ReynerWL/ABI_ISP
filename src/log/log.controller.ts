import { Controller, Get, Query, Request} from "@nestjs/common";
import { LogService } from "./log.service";
import { ExtendedRequest } from "#/core/request";

@Controller('log')
export class LogController {
  constructor(
    private readonly logService: LogService
) {}

  @Get()
  async findAll(
    @Request() req: ExtendedRequest,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.logService.findAll(req.user.role, page, limit);
  }
}