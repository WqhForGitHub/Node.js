import { IsString, IsOptional } from 'class-validator';
export class CreateLiveRoomDto {
  @IsString() title: string;
  @IsString() @IsOptional() streamer: string;
  @IsString() @IsOptional() viewers: string;
}
