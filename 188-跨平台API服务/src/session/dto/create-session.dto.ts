import { IsString, IsOptional } from 'class-validator';
export class CreateSessionDto {
  @IsString() userId: string;
  @IsString() @IsOptional() platform: string;
  @IsString() @IsOptional() token: string;
}
