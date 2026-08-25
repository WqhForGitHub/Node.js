import { IsString, IsOptional } from 'class-validator';
export class CreateViewerDto {
  @IsString() roomId: string;
  @IsString() @IsOptional() userId: string;
  @IsString() @IsOptional() joinedAt: string;
}
