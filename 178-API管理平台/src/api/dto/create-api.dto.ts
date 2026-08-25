import { IsString, IsOptional } from 'class-validator';
export class CreateApiDto {
  @IsString() name: string;
  @IsString() @IsOptional() method: string;
  @IsString() @IsOptional() path: string;
}
