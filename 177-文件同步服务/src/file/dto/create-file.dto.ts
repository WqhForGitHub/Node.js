import { IsString, IsOptional } from 'class-validator';
export class CreateFileDto {
  @IsString() path: string;
  @IsString() @IsOptional() checksum: string;
  @IsString() @IsOptional() size: string;
}
