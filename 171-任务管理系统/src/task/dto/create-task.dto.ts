import { IsString, IsOptional } from 'class-validator';
export class CreateTaskDto {
  @IsString() title: string;
  @IsString() @IsOptional() assignee: string;
  @IsString() @IsOptional() status: string;
}
