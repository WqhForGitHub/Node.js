import { IsString, IsOptional } from 'class-validator';
export class CreateAccountDto {
  @IsString() name: string;
  @IsString() @IsOptional() type: string;
  @IsString() @IsOptional() balance: string;
}
