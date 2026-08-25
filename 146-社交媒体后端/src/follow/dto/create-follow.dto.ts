import { IsString, IsOptional } from 'class-validator';
export class CreateFollowDto {
  @IsString() follower: string;
  @IsString() @IsOptional() followee: string;
}
