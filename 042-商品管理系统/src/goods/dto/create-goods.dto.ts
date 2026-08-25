import { IsString, IsOptional } from 'class-validator';
export class CreateGoodsDto {
  @IsString() name: string;
  @IsString() @IsOptional() price: string;
  @IsString() @IsOptional() sku: string;
}
