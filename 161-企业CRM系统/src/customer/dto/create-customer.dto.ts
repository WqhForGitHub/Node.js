import { IsString, IsOptional } from 'class-validator';
export class CreateCustomerDto {
  @IsString() name: string;
  @IsString() @IsOptional() company: string;
  @IsString() @IsOptional() email: string;
}
