import { IsString, IsOptional } from 'class-validator';
export class CreateProductDto {
  @IsString() name: string;
  @IsString() @IsOptional() sku: string;
  @IsString() @IsOptional() cost: string;
}
