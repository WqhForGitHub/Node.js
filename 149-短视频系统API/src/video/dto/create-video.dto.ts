import { IsString, IsOptional } from 'class-validator';
export class CreateVideoDto {
  @IsString() url: string;
  @IsString() @IsOptional() title: string;
  @IsString() @IsOptional() views: string;
}
