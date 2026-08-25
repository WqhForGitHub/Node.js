import { IsString, IsOptional } from 'class-validator';
export class CreateMessageDto {
  @IsString() roomId: string;
  @IsString() @IsOptional() sender: string;
  @IsString() @IsOptional() text: string;
}
