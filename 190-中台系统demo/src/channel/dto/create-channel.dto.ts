import { IsString, IsOptional } from 'class-validator';
export class CreateChannelDto {
  @IsString() name: string;
  @IsString() @IsOptional() type: string;
}
