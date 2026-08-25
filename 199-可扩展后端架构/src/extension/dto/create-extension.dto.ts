import { IsString, IsOptional } from 'class-validator';
export class CreateExtensionDto {
  @IsString() name: string;
  @IsString() @IsOptional() type: string;
}
