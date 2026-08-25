import { IsString, IsOptional } from 'class-validator';
export class CreateEmployeeDto {
  @IsString() name: string;
  @IsString() @IsOptional() department: string;
  @IsString() @IsOptional() position: string;
}
