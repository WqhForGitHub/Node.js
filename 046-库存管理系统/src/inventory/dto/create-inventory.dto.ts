import { IsString, IsOptional } from 'class-validator';
export class CreateInventoryDto {
  @IsString() sku: string;
  @IsString() @IsOptional() quantity: string;
  @IsString() @IsOptional() location: string;
}
