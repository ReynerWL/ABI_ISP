import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  ParseUUIDPipe,
  Put,
  Request,
} from '@nestjs/common';
import { PaketService } from './paket.service';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';
import { Public } from '#/auth/public.decorator';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '#/core/roles.enum';
import { Roles } from '#/core/roles.decorator';
import { PaginationDto } from '#/utils/pagination.dto';
import { SkipLogging } from '#/logging/skip-logging.decorator';
import { ExtendedRequest } from '#/core/request';

@Controller('paket')
@ApiTags('Paket')
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class PaketController {
  constructor(private readonly paketService: PaketService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiCreatedResponse({
    description: 'Sukses menambahkan data paket!',
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
  })
  async create(@Body() createPaketDto: CreatePaketDto) {
    const data = await this.paketService.create(createPaketDto);

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Sukses menambahkan data paket!',
      data: data,
    };
  }

  @Public()
  @Get()
  @ApiQuery({ name: 'query', required: false })
  @ApiQuery({ name: 'order', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiOkResponse({ description: 'Sukses mengambil data paket!' })
  @SkipLogging()
  async findAll(
    @Query('query') query?: string,
    @Query('status') status?: string,
    @Query('order') order: 'ASC' | 'DESC' = 'DESC',
    @Query() paginationDto?: PaginationDto,
  ) {
    let boolStatus: boolean | undefined = undefined;

    if (status === 'true') boolStatus = true;
    else if (status === 'false') boolStatus = false;

    const data = await this.paketService.findAll(
      query,
      boolStatus,
      order,
      paginationDto,
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Sukses mengambil data paket!',
      ...data,
    };
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Sukses mengedit data paket!',
  })
  @ApiBadRequestResponse({
    description: 'ID Validation error',
  })
  @ApiNotFoundResponse({
    description: 'Data paket tidak ditemukan',
  })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.paketService.findOne(id);

    return {
      statusCode: HttpStatus.OK,
      message: 'Sukses mengambil data paket!',
      data: data,
    };
  }

  @Put('active/:id')
  async paketActive(@Param('id', new ParseUUIDPipe()) id: string) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Sukses Update Status Paket',
      data: await this.paketService.PaketActive(id),
    };
  }

  @Put('inactive/:id')
  async paketInactive(@Param('id', new ParseUUIDPipe()) id: string) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Sukses Update Status Paket',
      data: await this.paketService.PaketInactive(id),
    };
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOkResponse({
    description: 'Sukses mengedit data paket!',
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updatePaketDto: UpdatePaketDto,
  ) {
    const data = await this.paketService.update(id, updatePaketDto);

    return {
      statusCode: HttpStatus.OK,
      message: 'Sukses mengedit data paket!',
      data: data,
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: ExtendedRequest) {
    return this.paketService.remove(id, req.user.role);
  }
}
