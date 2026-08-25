import { IsString, IsOptional } from 'class-validator';
export class CreateMessageDto {
  @IsString() from: string;
  @IsString() @IsOptional() to: string;
  @IsString() @IsOptional() content: string;
}
