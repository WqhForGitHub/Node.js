import { IsString, IsOptional } from 'class-validator';
export class CreateAuditLogDto {
  @IsString() actor: string;
  @IsString() @IsOptional() action: string;
  @IsString() @IsOptional() target: string;
}
