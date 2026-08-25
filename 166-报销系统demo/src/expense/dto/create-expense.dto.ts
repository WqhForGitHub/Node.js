import { IsString, IsOptional } from 'class-validator';
export class CreateExpenseDto {
  @IsString() title: string;
  @IsString() @IsOptional() amount: string;
  @IsString() @IsOptional() status: string;
}
