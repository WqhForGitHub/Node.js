import { IsString, IsOptional } from 'class-validator';
export class CreateConfigDto {
  @IsString() pluginId: string;
  @IsString() @IsOptional() key: string;
  @IsString() @IsOptional() value: string;
}
