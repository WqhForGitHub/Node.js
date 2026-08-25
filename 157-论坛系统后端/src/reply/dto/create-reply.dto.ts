import { IsString, IsOptional } from 'class-validator';
export class CreateReplyDto {
  @IsString() topicId: string;
  @IsString() @IsOptional() author: string;
  @IsString() @IsOptional() content: string;
}
