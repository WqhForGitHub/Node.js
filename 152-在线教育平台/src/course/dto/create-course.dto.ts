import { IsString, IsOptional } from 'class-validator';
export class CreateCourseDto {
  @IsString() title: string;
  @IsString() @IsOptional() instructor: string;
  @IsString() @IsOptional() price: string;
}
