import { IsString, IsOptional } from 'class-validator';
export class CreateOrderDto {
  @IsString() userId: string;
  @IsString() @IsOptional() total: string;
  @IsString() @IsOptional() status: string;
}
