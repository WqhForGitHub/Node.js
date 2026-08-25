import { IsString, IsOptional } from 'class-validator';
export class CreatePlaylistDto {
  @IsString() name: string;
  @IsString() @IsOptional() videoIds: string;
}
