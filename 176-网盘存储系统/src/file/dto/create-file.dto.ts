import { IsString, IsOptional } from 'class-validator';
export class CreateFileDto {
  @IsString() name: string;
  @IsString() @IsOptional() size: string;
  @IsString() @IsOptional() owner: string;
}
