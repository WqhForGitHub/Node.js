import { IsString, IsOptional } from 'class-validator';
export class CreateEnrollmentDto {
  @IsString() userId: string;
  @IsString() @IsOptional() courseId: string;
  @IsString() @IsOptional() progress: string;
}
