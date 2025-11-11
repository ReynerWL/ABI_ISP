import { IsOptional } from "class-validator";

export class CreateReportDto {
  @IsOptional()
  lokasi: string;
  @IsOptional()
  note: string;
  @IsOptional()
  customerId: string;
  @IsOptional()
  petugasId: string;
  @IsOptional()
  paketsId: string;
}
