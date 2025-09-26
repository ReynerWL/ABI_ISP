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
import { ApiTags } from '@nestjs/swagger';

@Controller('paket')
@ApiTags('Paket')
export class PaketController {
  constructor(private readonly paketService: PaketService) {}

  // @Roles(Role.ADMIN)
  @Post()
  async create(@Body() createPaketDto: CreatePaketDto) {
    const data = await this.paketService.create(createPaketDto);

    return {
      data: data,
      statusCode: HttpStatus.CREATED,
      message: 'Sukses menambahkan data paket!',
    };
  }

  @Public()
  @Get()
  findAll(
    @Query('query') query?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('order') order: 'ASC' | 'DESC' = 'ASC',
  ) {
    return this.paketService.findAll(
      query,
      startDate,
      endDate,
      Number(page),
      Number(limit),
      order,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paketService.findOne(id);
  }

  // @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updatePaketDto: UpdatePaketDto,
  ) {
    return this.paketService.update(id, updatePaketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paketService.remove(id);
  }
}
