import { IsString, IsOptional } from 'class-validator';
export class CreateRoomDto {
  @IsString() name: string;
  @IsString() @IsOptional() owner: string;
}
