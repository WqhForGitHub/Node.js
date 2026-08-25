import { IsString, IsOptional } from 'class-validator';
export class CreateConversationDto {
  @IsString() members: string;
  @IsString() @IsOptional() lastMessage: string;
}
