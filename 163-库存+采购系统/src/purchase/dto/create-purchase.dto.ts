import { IsString, IsOptional } from 'class-validator';
export class CreatePurchaseDto {
  @IsString() supplier: string;
  @IsString() @IsOptional() amount: string;
  @IsString() @IsOptional() status: string;
}
