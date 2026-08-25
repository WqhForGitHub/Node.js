import { IsString, IsOptional } from 'class-validator';
export class CreateUserDto {
  @IsString() name: string;
  @IsString() @IsOptional() email: string;
}
