import { IsString, IsOptional } from 'class-validator';
export class CreateRestaurantDto {
  @IsString() name: string;
  @IsString() @IsOptional() address: string;
  @IsString() @IsOptional() phone: string;
}
