import { IsString, IsOptional } from 'class-validator';
export class CreateIssueDto {
  @IsString() key: string;
  @IsString() @IsOptional() title: string;
  @IsString() @IsOptional() status: string;
  @IsString() @IsOptional() priority: string;
}
