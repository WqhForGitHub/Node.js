import { IsString, IsOptional } from 'class-validator';
export class CreateQuestionDto {
  @IsString() title: string;
  @IsString() @IsOptional() author: string;
  @IsString() @IsOptional() content: string;
}
