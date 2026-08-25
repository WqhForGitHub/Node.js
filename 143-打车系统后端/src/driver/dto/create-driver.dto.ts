import { IsString, IsOptional } from 'class-validator';
export class CreateDriverDto {
  @IsString() name: string;
  @IsString() @IsOptional() vehicle: string;
  @IsString() @IsOptional() status: string;
}
