import { IsString, IsOptional } from 'class-validator';
export class CreateInvoiceDto {
  @IsString() number: string;
  @IsString() @IsOptional() client: string;
  @IsString() @IsOptional() amount: string;
}
