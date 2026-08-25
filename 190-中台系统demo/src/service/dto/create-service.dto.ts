import { IsString, IsOptional } from 'class-validator';
export class CreateServiceDto {
  @IsString() name: string;
  @IsString() @IsOptional() endpoint: string;
  @IsString() @IsOptional() status: string;
}
