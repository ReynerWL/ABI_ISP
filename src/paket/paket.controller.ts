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

@Controller('paket')
@ApiTags('Paket')
@ApiInternalServerErrorResponse({ description: 'Internal Server Error' })
export class PaketController {
  constructor(private readonly paketService: PaketService) {}

  @Post()
  @Roles(Role.ADMIN)
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
  @ApiQuery({
    name: 'query',
    required: false,
    type: String,
    example: 'paket',
    description: 'Search keyword',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
    description: 'Sort order by price',
  })
  @ApiOkResponse({
    description: 'Sukses mengambil data paket!',
  })
  async findAll(
    @Query('query') query?: string,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
    @Query() paginationDto?: PaginationDto,
  ) {
    const data = await this.paketService.findAll(query, order, paginationDto);

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

  @Patch(':id')
  @Roles(Role.ADMIN)
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
  remove(@Param('id') id: string) {
    return this.paketService.remove(id);
  }
}
