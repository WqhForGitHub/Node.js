import { IsString, IsOptional } from 'class-validator';
export class CreateBlockDto {
  @IsString() pageId: string;
  @IsString() @IsOptional() type: string;
  @IsString() @IsOptional() content: string;
}
