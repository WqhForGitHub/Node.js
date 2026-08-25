import { IsString, IsOptional } from 'class-validator';
export class CreateCommentDto {
  @IsString() postId: string;
  @IsString() @IsOptional() content: string;
  @IsString() @IsOptional() author: string;
}
