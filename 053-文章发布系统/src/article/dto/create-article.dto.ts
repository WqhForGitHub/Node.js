import { IsString, IsOptional } from 'class-validator';
export class CreateArticleDto {
  @IsString() title: string;
  @IsString() @IsOptional() content: string;
  @IsString() @IsOptional() status: string;
}
