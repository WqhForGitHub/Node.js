import { IsString, IsOptional } from 'class-validator';
export class CreateTweetDto {
  @IsString() author: string;
  @IsString() @IsOptional() content: string;
  @IsString() @IsOptional() likes: string;
}
