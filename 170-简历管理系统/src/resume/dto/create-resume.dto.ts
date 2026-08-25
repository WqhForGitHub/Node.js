import { IsString, IsOptional } from 'class-validator';
export class CreateResumeDto {
  @IsString() candidateId: string;
  @IsString() @IsOptional() title: string;
  @IsString() @IsOptional() summary: string;
}
