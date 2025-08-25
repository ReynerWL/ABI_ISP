import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { PaketService } from './paket.service';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';

@Controller('paket')
export class PaketController {
  constructor(private readonly paketService: PaketService) {}

  @Post()
  create(@Body() createPaketDto: CreatePaketDto) {
    return this.paketService.create(createPaketDto);
  }

  @Get()
  findAll(
    @Query('query') query?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.paketService.findAll(query, startDate, endDate, Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paketService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePaketDto: UpdatePaketDto) {
    return this.paketService.update(id, updatePaketDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paketService.remove(id);
  }
}