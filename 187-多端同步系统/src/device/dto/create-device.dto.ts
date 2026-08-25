import { IsString, IsOptional } from 'class-validator';
export class CreateDeviceDto {
  @IsString() name: string;
  @IsString() @IsOptional() userId: string;
  @IsString() @IsOptional() lastSync: string;
}
