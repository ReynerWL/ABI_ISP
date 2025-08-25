import { IsNotEmpty, IsString } from "class-validator";

export class CreatePaymentDto {

    @IsNotEmpty()
    price: string;

    @IsNotEmpty()
    status: string;

    @IsNotEmpty()
    buktiPembayaran: string;

    reason: string;

    usersId: string;

    paketsId: string;

    banksId: string;
}
