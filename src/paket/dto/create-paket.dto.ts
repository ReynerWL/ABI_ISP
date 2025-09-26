import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePaketDto {
  @IsNotEmpty()
  @ApiProperty({ example: 'Basic Plan' })
  name: string;

  @IsNotEmpty()
  @ApiProperty({ example: 150000 })
  price: number;

  @IsNotEmpty()
  @ApiProperty({ example: '10mbps' })
  speed: string;

  @IsOptional()
  @ApiProperty({ example: 'https://example.com/image.jpg' })
  photo: string;
}
