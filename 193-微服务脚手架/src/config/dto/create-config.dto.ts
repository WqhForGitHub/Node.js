import { IsString, IsOptional } from 'class-validator';
export class CreateConfigDto {
  @IsString() key: string;
  @IsString() @IsOptional() value: string;
}
