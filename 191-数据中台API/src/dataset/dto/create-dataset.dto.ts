import { IsString, IsOptional } from 'class-validator';
export class CreateDatasetDto {
  @IsString() name: string;
  @IsString() @IsOptional() source: string;
  @IsString() @IsOptional() schema: string;
}
