import { IsString, IsOptional } from 'class-validator';
export class CreatePluginDto {
  @IsString() name: string;
  @IsString() @IsOptional() version: string;
  @IsString() @IsOptional() enabled: string;
}
