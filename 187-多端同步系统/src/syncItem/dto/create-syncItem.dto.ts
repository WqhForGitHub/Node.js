import { IsString, IsOptional } from 'class-validator';
export class CreateSyncItemDto {
  @IsString() deviceId: string;
  @IsString() @IsOptional() key: string;
  @IsString() @IsOptional() value: string;
}
