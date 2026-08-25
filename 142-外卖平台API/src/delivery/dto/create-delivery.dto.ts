import { IsString, IsOptional } from 'class-validator';
export class CreateDeliveryDto {
  @IsString() orderId: string;
  @IsString() @IsOptional() rider: string;
  @IsString() @IsOptional() status: string;
}
