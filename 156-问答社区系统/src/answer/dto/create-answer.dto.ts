import { IsString, IsOptional } from 'class-validator';
export class CreateAnswerDto {
  @IsString() questionId: string;
  @IsString() @IsOptional() author: string;
  @IsString() @IsOptional() content: string;
}
