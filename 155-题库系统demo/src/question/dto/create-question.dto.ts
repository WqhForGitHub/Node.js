import { IsString, IsOptional } from 'class-validator';
export class CreateQuestionDto {
  @IsString() content: string;
  @IsString() @IsOptional() type: string;
  @IsString() @IsOptional() answer: string;
}
