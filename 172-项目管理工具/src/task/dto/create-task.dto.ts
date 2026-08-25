import { IsString, IsOptional } from 'class-validator';
export class CreateTaskDto {
  @IsString() projectId: string;
  @IsString() @IsOptional() title: string;
  @IsString() @IsOptional() status: string;
}
