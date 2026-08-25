import { IsString, IsOptional } from 'class-validator';
export class CreateCommentDto {
  @IsString() photoId: string;
  @IsString() @IsOptional() author: string;
  @IsString() @IsOptional() text: string;
}
