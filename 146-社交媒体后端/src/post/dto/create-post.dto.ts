import { IsString, IsOptional } from 'class-validator';
export class CreatePostDto {
  @IsString() author: string;
  @IsString() @IsOptional() content: string;
  @IsString() @IsOptional() likes: string;
}
