import { IsString, IsOptional } from 'class-validator';
export class CreateInvoiceItemDto {
  @IsString() invoiceId: string;
  @IsString() @IsOptional() description: string;
  @IsString() @IsOptional() amount: string;
}
