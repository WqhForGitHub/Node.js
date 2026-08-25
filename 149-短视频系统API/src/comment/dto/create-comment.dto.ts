import { IsString, IsOptional } from 'class-validator';
export class CreateCommentDto {
  @IsString() videoId: string;
  @IsString() @IsOptional() author: string;
  @IsString() @IsOptional() text: string;
}
