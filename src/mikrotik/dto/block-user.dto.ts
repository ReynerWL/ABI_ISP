import { IsOptional } from "class-validator";

// src/mikrotik/dto/block-user.dto.ts
export class BlockUserDto {
  @IsOptional()
  username: string;
}
