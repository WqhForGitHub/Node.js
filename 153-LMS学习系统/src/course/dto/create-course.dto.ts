import { IsString, IsOptional } from 'class-validator';
export class CreateCourseDto {
  @IsString() title: string;
  @IsString() @IsOptional() category: string;
}
