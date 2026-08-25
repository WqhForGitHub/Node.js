import { IsString, IsOptional } from 'class-validator';
export class CreateExamDto {
  @IsString() title: string;
  @IsString() @IsOptional() duration: string;
  @IsString() @IsOptional() totalScore: string;
}
