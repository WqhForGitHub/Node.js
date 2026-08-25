import { IsString, IsOptional } from 'class-validator';
export class CreateLessonDto {
  @IsString() courseId: string;
  @IsString() @IsOptional() title: string;
  @IsString() @IsOptional() content: string;
}
