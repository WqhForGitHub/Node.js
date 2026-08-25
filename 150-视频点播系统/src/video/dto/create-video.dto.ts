import { IsString, IsOptional } from 'class-validator';
export class CreateVideoDto {
  @IsString() title: string;
  @IsString() @IsOptional() url: string;
  @IsString() @IsOptional() duration: string;
}
