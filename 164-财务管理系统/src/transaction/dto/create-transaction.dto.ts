import { IsString, IsOptional } from 'class-validator';
export class CreateTransactionDto {
  @IsString() fromAccount: string;
  @IsString() @IsOptional() toAccount: string;
  @IsString() @IsOptional() amount: string;
}
