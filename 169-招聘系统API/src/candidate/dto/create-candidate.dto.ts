import { IsString, IsOptional } from 'class-validator';
export class CreateCandidateDto {
  @IsString() name: string;
  @IsString() @IsOptional() position: string;
  @IsString() @IsOptional() status: string;
}
