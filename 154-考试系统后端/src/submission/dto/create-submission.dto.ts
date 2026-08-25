import { IsString, IsOptional } from 'class-validator';
export class CreateSubmissionDto {
  @IsString() examId: string;
  @IsString() @IsOptional() studentId: string;
  @IsString() @IsOptional() score: string;
}
