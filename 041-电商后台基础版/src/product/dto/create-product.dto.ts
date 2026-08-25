import { IsString, IsOptional } from 'class-validator';
export class CreateProductDto {
  @IsString() name: string;
  @IsString() @IsOptional() price: string;
  @IsString() @IsOptional() stock: string;
}
