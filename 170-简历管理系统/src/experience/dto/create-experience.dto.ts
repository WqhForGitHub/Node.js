import { IsString, IsOptional } from 'class-validator';
export class CreateExperienceDto {
  @IsString() resumeId: string;
  @IsString() @IsOptional() company: string;
  @IsString() @IsOptional() role: string;
}
