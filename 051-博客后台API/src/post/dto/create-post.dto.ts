import { IsString, IsOptional } from 'class-validator';
export class CreatePostDto {
  @IsString() title: string;
  @IsString() @IsOptional() content: string;
  @IsString() @IsOptional() author: string;
}
