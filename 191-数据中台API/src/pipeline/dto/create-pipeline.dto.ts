import { IsString, IsOptional } from 'class-validator';
export class CreatePipelineDto {
  @IsString() name: string;
  @IsString() @IsOptional() schedule: string;
  @IsString() @IsOptional() status: string;
}
