import { IsString, IsOptional } from 'class-validator';
export class CreateModuleDto {
  @IsString() name: string;
  @IsString() @IsOptional() enabled: string;
}
