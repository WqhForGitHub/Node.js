import { IsString, IsOptional } from 'class-validator';
export class CreateEnvironmentDto {
  @IsString() name: string;
  @IsString() @IsOptional() baseUrl: string;
}
