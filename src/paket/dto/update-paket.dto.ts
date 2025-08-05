import { PartialType } from '@nestjs/swagger';
import { CreatePaketDto } from './create-paket.dto';

export class UpdatePaketDto extends PartialType(CreatePaketDto) {}
