import { Injectable } from '@nestjs/common';
import { CreatePaketDto } from './dto/create-paket.dto';
import { UpdatePaketDto } from './dto/update-paket.dto';

@Injectable()
export class PaketService {
  create(createPaketDto: CreatePaketDto) {
    return 'This action adds a new paket';
  }

  findAll() {
    return `This action returns all paket`;
  }

  findOne(id: number) {
    return `This action returns a #${id} paket`;
  }

  update(id: number, updatePaketDto: UpdatePaketDto) {
    return `This action updates a #${id} paket`;
  }

  remove(id: number) {
    return `This action removes a #${id} paket`;
  }
}
