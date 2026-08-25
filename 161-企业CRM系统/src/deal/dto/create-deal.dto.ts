import { IsString, IsOptional } from 'class-validator';
export class CreateDealDto {
  @IsString() customerId: string;
  @IsString() @IsOptional() amount: string;
  @IsString() @IsOptional() stage: string;
}
