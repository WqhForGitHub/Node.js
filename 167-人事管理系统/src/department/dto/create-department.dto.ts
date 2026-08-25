import { IsString, IsOptional } from 'class-validator';
export class CreateDepartmentDto {
  @IsString() name: string;
  @IsString() @IsOptional() manager: string;
}
