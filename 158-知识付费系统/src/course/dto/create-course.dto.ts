import { IsString, IsOptional } from 'class-validator';
export class CreateCourseDto {
  @IsString() title: string;
  @IsString() @IsOptional() price: string;
  @IsString() @IsOptional() author: string;
}
