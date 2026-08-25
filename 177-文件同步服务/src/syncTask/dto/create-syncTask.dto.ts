import { IsString, IsOptional } from 'class-validator';
export class CreateSyncTaskDto {
  @IsString() fileId: string;
  @IsString() @IsOptional() device: string;
  @IsString() @IsOptional() status: string;
}
