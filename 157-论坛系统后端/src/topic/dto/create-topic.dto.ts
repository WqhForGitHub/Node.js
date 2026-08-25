import { IsString, IsOptional } from 'class-validator';
export class CreateTopicDto {
  @IsString() title: string;
  @IsString() @IsOptional() author: string;
  @IsString() @IsOptional() replies: string;
}
