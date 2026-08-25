import { IsString, IsOptional } from 'class-validator';
export class CreateServiceDto {
  @IsString() name: string;
  @IsString() @IsOptional() category: string;
}
